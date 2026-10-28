"""Direct Python entry points for the dashboard and future AI tools.

Services never commit: the caller owns the transaction. Reads use persisted
patterns; they do not rerun detectors on every agent message.
"""

from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID

import pandas as pd
from dateutil.relativedelta import relativedelta
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.config import CONFIG
from app.analytics.ledger import daily_balances
from app.analytics.preprocessing.salary import detect_salary
from app.analytics.preprocessing.timestamps import BUCHAREST, local_to_utc
from app.db import utcnow
from app.models import Account, Insight, Merchant, Pattern, Subscription, Transaction, UsageSignal, User


class NotFoundError(LookupError):
    pass


def get_user(session: Session, user_id: UUID) -> User:
    user = session.get(User, user_id)
    if user is None:
        raise NotFoundError("Utilizatorul nu există.")
    return user


def owned(session: Session, entity, object_id: UUID, user_id: UUID):
    if entity is Transaction:
        query = (
            select(Transaction).join(Account).where(Transaction.id == object_id, Account.user_id == user_id)
        )
    else:
        query = select(entity).where(entity.id == object_id, entity.user_id == user_id)
    result = session.scalar(query)
    if result is None:
        raise NotFoundError("Înregistrarea nu există.")
    return result


def transaction_query(user_id: UUID, currency: str | None = None):
    query = select(Transaction).join(Account).where(Account.user_id == user_id)
    if currency:
        query = query.where(Transaction.currency == currency)
    return query


def load_frame(session: Session, user_id: UUID, currency: str, as_of: datetime) -> pd.DataFrame:
    rows = session.execute(
        select(Transaction, Merchant.name_normalized)
        .join(Account, Transaction.account_id == Account.id)
        .join(Merchant, Transaction.merchant_id == Merchant.id)
        .where(
            Account.user_id == user_id,
            Transaction.currency == currency,
            Transaction.occurred_at <= as_of,
            Transaction.booked_at <= as_of,
        )
        .order_by(Transaction.booked_at, Transaction.statement_order)
    ).all()
    return pd.DataFrame(
        [
            {
                "id": str(tx.id),
                "account_id": str(tx.account_id),
                "merchant_id": str(tx.merchant_id),
                "merchant": name,
                "booked_at": tx.booked_at,
                "occurred_at": tx.occurred_at,
                "occurred_at_precision": tx.occurred_at_precision,
                "amount_minor": tx.amount_minor,
                "balance_minor": tx.balance_minor,
                "currency": tx.currency,
                "category": tx.category,
                "spending_type": tx.spending_type,
                "statement_order": tx.statement_order,
            }
            for tx, name in rows
        ]
    )


def period_start(period: str, as_of: datetime) -> datetime | None:
    local = as_of.astimezone(BUCHAREST)
    if period == "all":
        return None
    months = {"current_month": 0, "last_month": 1, "last_3_months": 2, "last_6_months": 5}
    if period not in months:
        raise ValueError("Perioadă invalidă.")
    start = local.replace(day=1, hour=0, minute=0, second=0, microsecond=0) - relativedelta(
        months=months[period]
    )
    return start.astimezone(UTC)


def get_spending_summary(
    session: Session,
    user_id: UUID,
    period: str = "last_3_months",
    currency: str | None = None,
    as_of: datetime | None = None,
) -> dict:
    user = get_user(session, user_id)
    currency = currency or user.currency
    as_of = as_of or utcnow()
    query = transaction_query(user_id, currency).where(Transaction.occurred_at <= as_of)
    start = period_start(period, as_of)
    if start:
        query = query.where(Transaction.occurred_at >= start)
    if period == "last_month":
        end = period_start("current_month", as_of)
        query = query.where(Transaction.occurred_at < end)
    income = 0
    expenses = 0
    categories: dict[str, int] = {}
    count = 0
    for tx in session.scalars(query):
        count += 1
        if tx.amount_minor > 0:
            income += tx.amount_minor
        else:
            expenses += tx.amount_minor
            categories[tx.category] = categories.get(tx.category, 0) + tx.amount_minor
    history_rows = list(
        session.scalars(
            transaction_query(user_id, currency)
            .where(Transaction.occurred_at <= as_of)
            .order_by(Transaction.occurred_at)
        )
    )
    history_days = (
        (
            history_rows[-1].occurred_at.astimezone(BUCHAREST).date()
            - history_rows[0].occurred_at.astimezone(BUCHAREST).date()
        ).days
        if history_rows
        else 0
    )
    sufficient = history_days >= CONFIG.default.min_history_days
    history = {
        "sufficient": sufficient,
        "history_days": history_days,
        "required_days": CONFIG.default.min_history_days,
        "message": (
            "Istoric suficient pentru analiză."
            if sufficient
            else f"Mai am nevoie de date pentru identificarea tiparelor; sunt necesare minimum {CONFIG.default.min_history_days} de zile."
        ),
    }
    return {
        "period": period,
        "currency": currency,
        "income_minor": income,
        "expenses_minor": expenses,
        "net_minor": income + expenses,
        "transaction_count": count,
        "categories": categories,
        "history": history,
    }


def get_cashflow_pattern(
    session: Session,
    user_id: UUID,
    months: int = 3,
    currency: str | None = None,
    as_of: datetime | None = None,
) -> dict:
    if not 1 <= months <= 120:
        raise ValueError("Numărul de luni trebuie să fie între 1 și 120.")
    user = get_user(session, user_id)
    currency = currency or user.currency
    as_of = as_of or utcnow()
    frame = load_frame(session, user_id, currency, as_of)
    estimated_salary = detect_salary(frame) if currency != user.currency else None
    income = (
        (user.monthly_income_minor or 0)
        if currency == user.currency
        else (estimated_salary.monthly_income_minor if estimated_salary else 0)
    )
    balances = daily_balances(frame)
    start = as_of.astimezone(BUCHAREST).date().replace(day=1) - relativedelta(months=months - 1)
    end = as_of.astimezone(BUCHAREST).date()
    threshold = max(CONFIG.critical_floor_minor, income * CONFIG.critical_income_share_percent // 100)
    # Extend the last observed ledger balance; never invent an opening balance before history.
    if balances:
        day = max(balances) + timedelta(days=1)
        closing = balances[max(balances)]
        while day <= end:
            balances[day] = closing
            day += timedelta(days=1)
    points = [
        {"date": day, "balance_minor": balance, "critical": balance < threshold}
        for day, balance in balances.items()
        if start <= day <= end
    ]
    salary_day = (
        user.salary_day
        if currency == user.currency
        else (estimated_salary.salary_day if estimated_salary else None)
    )
    return {
        "currency": currency,
        "salary_day": salary_day,
        "critical_threshold_minor": threshold,
        "points": points,
        "critical_days": sum(point["critical"] for point in points),
    }


def find_recurring_expenses(
    session: Session, user_id: UUID, min_frequency: int = 1, currency: str | None = None
) -> list[Pattern]:
    get_user(session, user_id)
    query = select(Pattern).where(
        Pattern.user_id == user_id,
        Pattern.active.is_(True),
        Pattern.type.in_(["subscription", "daily_habit", "weekly_habit", "frequent_merchant"]),
        Pattern.support >= min_frequency,
    )
    if currency:
        query = query.where(Pattern.currency == currency)
    return list(session.scalars(query.order_by(Pattern.monthly_impact_minor.desc(), Pattern.id)))


def list_subscriptions(session: Session, user_id: UUID, as_of: datetime | None = None) -> list[dict]:
    get_user(session, user_id)
    as_of = as_of or utcnow()
    cutoff = as_of - timedelta(days=CONFIG.usage_window_days)
    subscriptions = list(
        session.scalars(select(Subscription).where(Subscription.user_id == user_id).order_by(Subscription.id))
    )
    signals = list(
        session.scalars(
            select(UsageSignal).where(
                UsageSignal.user_id == user_id,
                UsageSignal.occurred_at >= cutoff,
                UsageSignal.occurred_at <= as_of,
            )
        )
    )
    names = dict(session.execute(select(Merchant.id, Merchant.name_normalized)).all())
    result = []
    for subscription in subscriptions:
        data = {column.name: getattr(subscription, column.name) for column in subscription.__table__.columns}
        data["merchant"] = names[subscription.merchant_id]
        count = sum(
            signal.subscription_id == subscription.id and signal.source == subscription.usage_source
            for signal in signals
        )
        data["usage_count_30_days"] = count
        data["cost_per_use_minor"] = abs(subscription.amount_minor) // count if count else None
        data["usage_monitoring_complete"] = bool(
            subscription.usage_source
            and subscription.usage_connected_at
            and subscription.usage_connected_at <= cutoff
        )
        result.append(data)
    return result


def list_insights(session: Session, user_id: UUID, status: str | None = None) -> list[Insight]:
    get_user(session, user_id)
    query = select(Insight).join(Pattern).where(Insight.user_id == user_id, Pattern.active.is_(True))
    if status:
        query = query.where(Insight.status == status)
    return list(session.scalars(query.order_by(Insight.score.desc(), Insight.created_at.desc(), Insight.id)))


def date_boundary(day: date, end: bool = False):
    return local_to_utc(datetime.combine(day + timedelta(days=1) if end else day, time.min))
