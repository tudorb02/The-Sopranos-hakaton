from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

Category = Literal[
    "salary",
    "rent",
    "utilities",
    "loan",
    "gym",
    "subscription",
    "groceries",
    "transport",
    "pharmacy",
    "uncategorized",
    "coffee",
    "restaurants",
    "delivery",
    "shopping",
    "entertainment",
    "gifts",
]
InsightStatus = Literal["new", "seen", "accepted", "dismissed"]
UsageSource = Literal["geofence", "health", "manual"]
Currency = str


class ORMResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Request(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody


class ImportResponse(ORMResponse):
    id: UUID
    account_id: UUID
    status: Literal["pending", "processing", "completed", "failed"]
    inserted_count: int
    duplicate_count: int
    error_code: str | None
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None


class TransactionResponse(ORMResponse):
    id: UUID
    account_id: UUID
    occurred_at: datetime
    occurred_at_precision: Literal["minute", "day"]
    booked_at: datetime
    amount_minor: int
    balance_minor: int
    currency: str
    description_raw: str
    merchant_id: UUID
    category: Category
    spending_type: Literal["fixed", "essential", "discretionary"]
    is_recurring: bool
    category_corrected: bool


class TransactionPage(BaseModel):
    items: list[TransactionResponse]
    total: int
    limit: int
    offset: int


class TransactionPatch(Request):
    category: Category


class SummaryResponse(BaseModel):
    period: str
    currency: str
    income_minor: int
    expenses_minor: int
    net_minor: int
    transaction_count: int
    categories: dict[str, int]
    history: "HistoryResponse"


class BalancePoint(BaseModel):
    date: date
    balance_minor: int
    critical: bool


class CashflowResponse(BaseModel):
    currency: str
    salary_day: int | None
    critical_threshold_minor: int
    critical_days: int
    points: list[BalancePoint]


class PatternResponse(ORMResponse):
    id: UUID
    type: str
    evidence: dict
    support: int
    confidence: float
    monthly_impact_minor: int
    currency: str
    period_start: datetime
    period_end: datetime
    detector_version: str


class InsightResponse(ORMResponse):
    id: UUID
    pattern_id: UUID
    type: str
    payload: dict
    status: InsightStatus
    score: Decimal
    created_at: datetime


class InsightPatch(Request):
    status: InsightStatus


class SubscriptionResponse(ORMResponse):
    id: UUID
    merchant_id: UUID
    merchant: str
    amount_minor: int
    currency: str
    period: Literal["monthly", "yearly"]
    next_charge_at: datetime
    last_charge_at: datetime
    status: Literal["active", "cancel_planned", "cancelled"]
    usage_source: UsageSource | None
    usage_connected_at: datetime | None
    usage_count_30_days: int
    cost_per_use_minor: int | None
    usage_monitoring_complete: bool


class SubscriptionPatch(Request):
    status: Literal["active", "cancel_planned", "cancelled"] | None = None
    usage_source: UsageSource | None = None
    usage_connected_at: AwareDatetime | None = None

    @model_validator(mode="after")
    def validate_patch(self):
        fields = self.model_fields_set
        if not fields or ("status" in fields and self.status is None):
            raise ValueError("Actualizare invalidă.")
        if ("usage_source" in fields) != ("usage_connected_at" in fields):
            raise ValueError("Sursa și data conectării trebuie trimise împreună.")
        if (self.usage_source is None) != (self.usage_connected_at is None):
            raise ValueError("Sursa și data conectării trebuie să fie ambele definite sau null.")
        return self


class UsageSignalCreate(Request):
    subscription_id: UUID
    source: UsageSource
    occurred_at: AwareDatetime


class UsageSignalResponse(ORMResponse):
    id: UUID
    subscription_id: UUID
    source: UsageSource
    occurred_at: datetime


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


class HistoryResponse(BaseModel):
    sufficient: bool
    history_days: int = Field(ge=0)
    required_days: int
    message: str
