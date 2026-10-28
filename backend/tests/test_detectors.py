import json
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pandas as pd
import pytest

from app.analytics.detectors.base import SubscriptionSnapshot, UsageSnapshot, UserProfile
from app.analytics.detectors.payday_cycle import PaydayCycleDetector
from app.analytics.detectors.recurring import RecurringDetector
from app.analytics.detectors.time_of_day import TimeOfDayDetector
from app.analytics.detectors.unused_subscription import UnusedSubscriptionDetector
from app.analytics.preprocessing.categorize import categorize
from app.analytics.preprocessing.merchants import resolve_merchant
from app.analytics.validation import validate
from app.services.csv_parser import RaiffeisenCSVParser

ROOT = Path(__file__).resolve().parents[1] / "seed" / "output"
AS_OF = datetime(2026, 10, 31, 21, 59, 59, tzinfo=UTC)


def seed_frame(persona):
    directory = ROOT / persona
    profile = json.loads((directory / "profile.json").read_text())
    names = []
    rows = []
    for index, row in enumerate(RaiffeisenCSVParser().parse((directory / "transactions.csv").read_bytes())):
        name = resolve_merchant(row.description_raw, names, {})
        if name not in names:
            names.append(name)
        category, spending_type = categorize(name)
        rows.append(
            {
                "id": str(index),
                "merchant_id": name,
                "merchant": name,
                "account_id": "account",
                "occurred_at": row.occurred_at,
                "booked_at": row.booked_at,
                "amount_minor": row.amount_minor,
                "balance_minor": row.balance_minor,
                "occurred_at_precision": row.occurred_at_precision,
                "currency": "RON",
                "category": category,
                "spending_type": spending_type,
                "statement_order": index,
            }
        )
    return pd.DataFrame(rows), UserProfile(AS_OF, profile["salary_day"], profile["monthly_income_minor"])


@pytest.mark.parametrize("persona,kind", [("daily_coffee", "daily_habit"), ("unused_gym", "subscription")])
def test_recurring_positive_seed_and_input_not_mutated(persona, kind):
    frame, profile = seed_frame(persona)
    original = frame.copy(deep=True)
    found = RecurringDetector().detect(frame, profile)
    assert any(pattern.type == kind and validate(pattern) for pattern in found)
    pd.testing.assert_frame_equal(frame, original)


def test_recurring_negative_fixed_bills_irregular_and_insufficient_history():
    frame, profile = seed_frame("balanced")
    assert not [pattern for pattern in RecurringDetector().detect(frame, profile) if validate(pattern)]
    assert not RecurringDetector().detect(frame.iloc[:1], profile)
    frame, profile = seed_frame("unused_gym")
    frame.loc[frame.category == "gym", "amount_minor"] = [-23000, -50000, -10000, -40000, -20000, -70000]
    assert not any(p.type == "subscription" for p in RecurringDetector().detect(frame, profile))


def test_weekly_habit_positive_and_negative():
    rows = []
    for index in range(14):
        when = datetime(2026, 6, 1, 12, tzinfo=UTC) + timedelta(weeks=index)
        rows.append(
            {
                "merchant_id": "cafe",
                "merchant": "CAFE",
                "currency": "RON",
                "occurred_at": when,
                "amount_minor": -(3000 + index * 100),
                "category": "coffee",
                "spending_type": "discretionary",
            }
        )
    frame = pd.DataFrame(rows)
    profile = UserProfile(AS_OF)
    assert any(p.type == "weekly_habit" and validate(p) for p in RecurringDetector().detect(frame, profile))
    frame.spending_type = "essential"
    assert not RecurringDetector().detect(frame, profile)


def test_payday_cycle_positive_seed_and_negative_reserve():
    frame, profile = seed_frame("end_of_month")
    found = PaydayCycleDetector().detect(frame, profile)
    assert len(found) == 1 and found[0].type == "end_of_cycle_shortage"
    assert validate(found[0])
    assert found[0].evidence["cycles_affected"] >= 2
    assert 0.4 < found[0].evidence["spent_first_7_days_share"] < 0.6
    frame.balance_minor += 1000000
    assert not PaydayCycleDetector().detect(frame, profile)


def test_payday_missing_salary_incomplete_cycles_and_balanced():
    frame, profile = seed_frame("balanced")
    assert not PaydayCycleDetector().detect(frame, profile)
    assert not PaydayCycleDetector().detect(frame, replace(profile, salary_day=None))
    frame, profile = seed_frame("end_of_month")
    frame = frame[pd.to_datetime(frame.occurred_at, utc=True) >= datetime(2026, 10, 1, tzinfo=UTC)]
    assert not PaydayCycleDetector().detect(frame, profile)


def test_time_of_day_positive_local_time_and_before_ten():
    frame, profile = seed_frame("daily_coffee")
    found = TimeOfDayDetector().detect(frame, profile)
    morning = next(pattern for pattern in found if pattern.type == "morning_spending")
    assert validate(morning) and morning.confidence >= 0.95
    assert morning.evidence["window"] == "07:00–10:00" and morning.evidence["before_hour"] == 10


def test_time_of_day_negative_balanced_day_precision_and_essential():
    frame, profile = seed_frame("balanced")
    assert not TimeOfDayDetector().detect(frame, profile)
    frame, profile = seed_frame("daily_coffee")
    frame.occurred_at_precision = "day"
    assert not TimeOfDayDetector().detect(frame, profile)
    frame.occurred_at_precision = "minute"
    frame.spending_type = "essential"
    assert not TimeOfDayDetector().detect(frame, profile)


def subscription_profile(frame, profile):
    group = frame[frame.merchant == "18GYM"]
    subscription = SubscriptionSnapshot(
        "18GYM",
        "18GYM",
        -23000,
        "RON",
        "active",
        group.occurred_at.max(),
        "geofence",
        datetime(2026, 5, 1, tzinfo=UTC),
    )
    return replace(profile, subscriptions=(subscription,))


def test_unused_subscription_positive_with_connected_source():
    frame, profile = seed_frame("unused_gym")
    profile = subscription_profile(frame, profile)
    found = UnusedSubscriptionDetector().detect(frame, profile)
    assert len(found) == 1 and validate(found[0])
    assert found[0].evidence["cost_per_use_minor"] is None


@pytest.mark.parametrize(
    "change", ["no_source", "recent_signal", "cancelled", "new_connection", "stale_charge"]
)
def test_unused_subscription_negative(change):
    frame, profile = seed_frame("unused_gym")
    profile = subscription_profile(frame, profile)
    subscription = profile.subscriptions[0]
    if change == "no_source":
        subscription = replace(subscription, usage_source=None)
    if change == "cancelled":
        subscription = replace(subscription, status="cancelled")
    if change == "new_connection":
        subscription = replace(subscription, usage_connected_at=AS_OF - timedelta(days=2))
    if change == "stale_charge":
        subscription = replace(subscription, last_charge_at=AS_OF - timedelta(days=90))
    if change == "recent_signal":
        profile = replace(
            profile, usage_signals=(UsageSnapshot("18GYM", "geofence", AS_OF - timedelta(days=1)),)
        )
    assert not UnusedSubscriptionDetector().detect(frame, replace(profile, subscriptions=(subscription,)))


@pytest.mark.parametrize(
    "detector",
    [RecurringDetector(), PaydayCycleDetector(), TimeOfDayDetector(), UnusedSubscriptionDetector()],
)
def test_empty_frames(detector):
    assert detector.detect(pd.DataFrame(), UserProfile(AS_OF)) == []
