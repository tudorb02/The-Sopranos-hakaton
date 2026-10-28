"""SQLAlchemy entities. Money is always stored as integer minor units."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON, BigInteger, Boolean, CheckConstraint, ForeignKey, Index, Integer,
    Numeric, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, UTCDateTime, utcnow


class Identity:
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)


class User(Identity, Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("salary_day BETWEEN 1 AND 31"),)
    email: Mapped[str | None] = mapped_column(String(320), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    locale: Mapped[str] = mapped_column(String(20), default="ro-RO")
    currency: Mapped[str] = mapped_column(String(3), default="RON")
    salary_day: Mapped[int | None] = mapped_column(Integer)
    monthly_income_minor: Mapped[int | None] = mapped_column(BigInteger)
    declared_problems: Mapped[list] = mapped_column(JSON, default=list)
    context: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class Account(Identity, Base):
    __tablename__ = "accounts"
    __table_args__ = (UniqueConstraint("user_id", "provider", "currency"),)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(30), default="csv")
    iban_masked: Mapped[str | None] = mapped_column(String(40))
    currency: Mapped[str] = mapped_column(String(3), default="RON")


class Merchant(Identity, Base):
    __tablename__ = "merchants"
    name_normalized: Mapped[str] = mapped_column(String(240), unique=True)
    category_default: Mapped[str] = mapped_column(String(60), default="uncategorized")


class MerchantAlias(Identity, Base):
    __tablename__ = "merchant_aliases"
    alias: Mapped[str] = mapped_column(String(240), unique=True)
    merchant_id: Mapped[UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"))
    category_override: Mapped[str | None] = mapped_column(String(60))


class Import(Identity, Base):
    __tablename__ = "imports"
    __table_args__ = (CheckConstraint("status IN ('pending','processing','completed','failed')"),)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    account_id: Mapped[UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    inserted_count: Mapped[int] = mapped_column(Integer, default=0)
    duplicate_count: Mapped[int] = mapped_column(Integer, default=0)
    error_code: Mapped[str | None] = mapped_column(String(60))
    error_message: Mapped[str | None] = mapped_column(String(240))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())


class Transaction(Identity, Base):
    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint("account_id", "dedup_hash"),
        CheckConstraint("occurred_at_precision IN ('minute','day')"),
        CheckConstraint("spending_type IN ('fixed','essential','discretionary')"),
        Index("ix_transactions_account_booked", "account_id", "booked_at", "statement_order"),
    )
    account_id: Mapped[UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    import_id: Mapped[UUID] = mapped_column(ForeignKey("imports.id"))
    external_id: Mapped[str | None] = mapped_column(String(200))
    dedup_hash: Mapped[str] = mapped_column(String(64))
    booked_at: Mapped[datetime] = mapped_column(UTCDateTime())
    occurred_at: Mapped[datetime] = mapped_column(UTCDateTime(), index=True)
    occurred_at_precision: Mapped[str] = mapped_column(String(10))
    statement_order: Mapped[int] = mapped_column(Integer)
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    balance_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="RON")
    description_raw: Mapped[str] = mapped_column(Text)
    merchant_id: Mapped[UUID] = mapped_column(ForeignKey("merchants.id"), index=True)
    category: Mapped[str] = mapped_column(String(60), index=True)
    spending_type: Mapped[str] = mapped_column(String(20))
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    category_corrected: Mapped[bool] = mapped_column(Boolean, default=False)


class Subscription(Identity, Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        UniqueConstraint("user_id", "merchant_id", "currency"),
        CheckConstraint("status IN ('active','cancel_planned','cancelled')"),
        CheckConstraint("period IN ('monthly','yearly')"),
        CheckConstraint("amount_minor < 0"),
        CheckConstraint("usage_source IS NULL OR usage_source IN ('geofence','health','manual')"),
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    merchant_id: Mapped[UUID] = mapped_column(ForeignKey("merchants.id"))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="RON")
    period: Mapped[str] = mapped_column(String(10), default="monthly")
    next_charge_at: Mapped[datetime] = mapped_column(UTCDateTime())
    last_charge_at: Mapped[datetime] = mapped_column(UTCDateTime())
    status: Mapped[str] = mapped_column(String(20), default="active")
    usage_source: Mapped[str | None] = mapped_column(String(20))
    usage_connected_at: Mapped[datetime | None] = mapped_column(UTCDateTime())


class UsageSignal(Identity, Base):
    __tablename__ = "usage_signals"
    __table_args__ = (
        CheckConstraint("source IN ('geofence','health','manual')"),
        UniqueConstraint("subscription_id", "source", "occurred_at"),
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    subscription_id: Mapped[UUID] = mapped_column(ForeignKey("subscriptions.id", ondelete="CASCADE"))
    source: Mapped[str] = mapped_column(String(20))
    occurred_at: Mapped[datetime] = mapped_column(UTCDateTime(), index=True)


class Pattern(Identity, Base):
    __tablename__ = "patterns"
    __table_args__ = (UniqueConstraint("user_id", "fingerprint"),)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    fingerprint: Mapped[str] = mapped_column(String(64))
    type: Mapped[str] = mapped_column(String(60))
    evidence: Mapped[dict] = mapped_column(JSON)
    support: Mapped[int] = mapped_column(Integer)
    confidence: Mapped[Decimal] = mapped_column(Numeric(12, 10))
    monthly_impact_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3))
    period_start: Mapped[datetime] = mapped_column(UTCDateTime())
    period_end: Mapped[datetime] = mapped_column(UTCDateTime())
    detector_version: Mapped[str] = mapped_column(String(30))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class Insight(Identity, Base):
    __tablename__ = "insights"
    __table_args__ = (
        UniqueConstraint("pattern_id"),
        CheckConstraint("status IN ('new','seen','accepted','dismissed')"),
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    pattern_id: Mapped[UUID] = mapped_column(ForeignKey("patterns.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(60))
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="new")
    score: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
