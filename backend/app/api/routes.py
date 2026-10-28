from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics.pipeline import AnalyticsPipeline
from app.analytics.preprocessing.categorize import SPENDING_TYPES
from app.api.schemas import (
    CashflowResponse,
    Category,
    ErrorResponse,
    ImportResponse,
    InsightPatch,
    InsightResponse,
    InsightStatus,
    PatternResponse,
    SubscriptionPatch,
    SubscriptionResponse,
    SummaryResponse,
    TransactionPage,
    TransactionPatch,
    TransactionResponse,
    UsageSignalCreate,
    UsageSignalResponse,
)
from app.db import get_session, utcnow
from app.models import Import, Insight, Subscription, Transaction, UsageSignal, User
from app.services import analytics_service as analytics
from app.services.import_service import MAX_IMPORT_BYTES, import_csv

DB = Annotated[Session, Depends(get_session)]


def development_user(db: DB, user_id: Annotated[UUID, Header(alias="X-User-Id")]) -> User:
    # TODO: Replace this development-only identity header with verified authentication.
    return analytics.get_user(db, user_id)


DevUser = Annotated[User, Depends(development_user)]
router = APIRouter(
    prefix="/api/v1",
    responses={
        404: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
)
CurrencyQuery = Annotated[str | None, Query(pattern=r"^[A-Z]{3}$")]


@router.post(
    "/accounts/import",
    response_model=ImportResponse,
    status_code=202,
    responses={413: {"model": ErrorResponse}, 400: {"model": ErrorResponse}},
    tags=["imports"],
)
def create_import(
    db: DB,
    user: DevUser,
    file: Annotated[UploadFile, File()],
    account_id: Annotated[UUID | None, Form()] = None,
    currency: Annotated[str, Form(pattern=r"^[A-Z]{3}$")] = "RON",
):
    """Import sincron expus ca job. Limita fișierului: 10 MiB."""
    data = file.file.read(MAX_IMPORT_BYTES + 1)
    if len(data) > MAX_IMPORT_BYTES:
        raise HTTPException(413, "Fișierul depășește limita de 10 MiB.")
    return import_csv(db, user.id, data, account_id, currency)


@router.get("/imports/{id}", response_model=ImportResponse, tags=["imports"])
def get_import(id: UUID, db: DB, user: DevUser):
    return analytics.owned(db, Import, id, user.id)


@router.get(
    "/transactions",
    response_model=TransactionPage,
    tags=["transactions"],
    responses={400: {"model": ErrorResponse}},
)
def transactions(
    db: DB,
    user: DevUser,
    from_date: Annotated[date | None, Query(alias="from")] = None,
    to_date: Annotated[date | None, Query(alias="to")] = None,
    category: Category | None = None,
    merchant: UUID | None = None,
    currency: CurrencyQuery = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    if from_date and to_date and from_date > to_date:
        raise HTTPException(400, "Interval de date invalid.")
    query = analytics.transaction_query(user.id, currency)
    if from_date:
        query = query.where(Transaction.occurred_at >= analytics.date_boundary(from_date))
    if to_date:
        query = query.where(Transaction.occurred_at < analytics.date_boundary(to_date, end=True))
    if category:
        query = query.where(Transaction.category == category)
    if merchant:
        query = query.where(Transaction.merchant_id == merchant)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = list(
        db.scalars(query.order_by(Transaction.occurred_at.desc(), Transaction.id).limit(limit).offset(offset))
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.patch("/transactions/{id}", response_model=TransactionResponse, tags=["transactions"])
def patch_transaction(id: UUID, body: TransactionPatch, db: DB, user: DevUser):
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    tx = analytics.owned(db, Transaction, id, user.id)
    tx.category = body.category
    tx.spending_type = SPENDING_TYPES[body.category]
    tx.category_corrected = True
    db.flush()
    AnalyticsPipeline(db).run_incremental(tx.id)
    db.commit()
    return tx


@router.get("/analytics/summary", response_model=SummaryResponse, tags=["analytics"])
def summary(
    db: DB,
    user: DevUser,
    period: Literal["current_month", "last_month", "last_3_months", "last_6_months", "all"] = "last_3_months",
    currency: CurrencyQuery = None,
):
    return analytics.get_spending_summary(db, user.id, period, currency)


@router.get("/analytics/cashflow", response_model=CashflowResponse, tags=["analytics"])
def cashflow(
    db: DB, user: DevUser, months: Annotated[int, Query(ge=1, le=120)] = 3, currency: CurrencyQuery = None
):
    return analytics.get_cashflow_pattern(db, user.id, months, currency)


@router.get("/analytics/recurring", response_model=list[PatternResponse], tags=["analytics"])
def recurring(
    db: DB, user: DevUser, min_frequency: Annotated[int, Query(ge=1)] = 1, currency: CurrencyQuery = None
):
    return analytics.find_recurring_expenses(db, user.id, min_frequency, currency)


@router.get("/insights", response_model=list[InsightResponse], tags=["insights"])
def insights(db: DB, user: DevUser, status: InsightStatus | None = None):
    return analytics.list_insights(db, user.id, status)


@router.patch("/insights/{id}", response_model=InsightResponse, tags=["insights"])
def patch_insight(id: UUID, body: InsightPatch, db: DB, user: DevUser):
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    insight = analytics.owned(db, Insight, id, user.id)
    insight.status = body.status
    db.commit()
    return insight


@router.get("/subscriptions", response_model=list[SubscriptionResponse], tags=["subscriptions"])
def subscriptions(db: DB, user: DevUser):
    return analytics.list_subscriptions(db, user.id)


@router.patch(
    "/subscriptions/{id}",
    response_model=SubscriptionResponse,
    tags=["subscriptions"],
    responses={400: {"model": ErrorResponse}},
)
def patch_subscription(id: UUID, body: SubscriptionPatch, db: DB, user: DevUser):
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    subscription = analytics.owned(db, Subscription, id, user.id)
    if body.usage_connected_at and body.usage_connected_at > utcnow():
        raise HTTPException(400, "Data conectării nu poate fi în viitor.")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(subscription, key, value)
    db.flush()
    AnalyticsPipeline(db).run_full(user.id)
    db.commit()
    return next(row for row in analytics.list_subscriptions(db, user.id) if row["id"] == id)


@router.post(
    "/usage-signals",
    response_model=UsageSignalResponse,
    status_code=201,
    tags=["subscriptions"],
    responses={400: {"model": ErrorResponse}},
)
def create_usage_signal(body: UsageSignalCreate, db: DB, user: DevUser):
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    analytics.owned(db, Subscription, body.subscription_id, user.id)
    if body.occurred_at > utcnow():
        raise HTTPException(400, "Semnalul de utilizare nu poate fi în viitor.")
    signal = db.scalar(
        select(UsageSignal).where(
            UsageSignal.subscription_id == body.subscription_id,
            UsageSignal.source == body.source,
            UsageSignal.occurred_at == body.occurred_at,
        )
    )
    if signal is None:
        signal = UsageSignal(user_id=user.id, **body.model_dump())
        db.add(signal)
    db.flush()
    AnalyticsPipeline(db).run_full(user.id)
    db.commit()
    return signal
