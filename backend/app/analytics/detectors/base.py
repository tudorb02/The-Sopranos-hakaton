from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Protocol

import pandas as pd

from app.analytics.preprocessing.timestamps import BUCHAREST


@dataclass
class Pattern:
    type: str
    evidence: dict
    support: int
    confidence: float
    monthly_impact_minor: int
    period: tuple[date, date]
    detector_version: str


@dataclass(frozen=True)
class SubscriptionSnapshot:
    merchant: str
    merchant_id: str
    amount_minor: int
    currency: str
    status: str
    last_charge_at: datetime
    usage_source: str | None
    usage_connected_at: datetime | None


@dataclass(frozen=True)
class UsageSnapshot:
    merchant_id: str
    source: str
    occurred_at: datetime


@dataclass(frozen=True)
class UserProfile:
    as_of: datetime
    salary_day: int | None = None
    monthly_income_minor: int | None = None
    currency: str = "RON"
    declared_problems: tuple[str, ...] = ()
    subscriptions: tuple[SubscriptionSnapshot, ...] = ()
    usage_signals: tuple[UsageSnapshot, ...] = ()
    previous_statuses: dict[str, str] = field(default_factory=dict)


class Detector(Protocol):
    name: str
    min_history_days: int

    def detect(self, txs: pd.DataFrame, profile: UserProfile) -> list[Pattern]: ...


def local_dates(txs: pd.DataFrame) -> pd.Series:
    return pd.to_datetime(txs.occurred_at, utc=True).dt.tz_convert(BUCHAREST)


def period_of(txs: pd.DataFrame) -> tuple[date, date]:
    dates = local_dates(txs)
    return dates.min().date(), dates.max().date()


def common_evidence(group: pd.DataFrame, history: pd.DataFrame) -> dict:
    dates = local_dates(group)
    start, end = period_of(history)
    return {
        "currency": str(group.iloc[0].currency),
        "weeks": int(dates.dt.strftime("%G-%V").nunique()),
        "months": int(dates.dt.strftime("%Y-%m").nunique()),
        "history_days": (end - start).days,
    }


def monthly_total(group: pd.DataFrame) -> int:
    start, end = period_of(group)
    total = sum(abs(int(amount)) for amount in group.amount_minor)
    return total * 30 // max(30, (end - start).days + 1)
