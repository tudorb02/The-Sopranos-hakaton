from decimal import Decimal

import numpy as np
import pandas as pd

from app.analytics.config import CONFIG, AnalyticsConfig
from app.analytics.detectors.base import (
    Pattern,
    UserProfile,
    common_evidence,
    local_dates,
    monthly_total,
    period_of,
)
from app.analytics.preprocessing.salary import median_minor


class RecurringDetector:
    name = "recurring"
    min_history_days = CONFIG.default.min_history_days

    def __init__(self, config: AnalyticsConfig = CONFIG):
        self.config = config
        self.min_history_days = config.default.min_history_days

    def detect(self, txs: pd.DataFrame, profile: UserProfile) -> list[Pattern]:
        if txs.empty:
            return []
        patterns = []
        expenses = txs[txs.amount_minor < 0]
        for (_, _), group in expenses.groupby(["merchant_id", "currency"]):
            group = group.sort_values("occurred_at")
            if len(group) < self.config.subscription.min_support:
                continue
            dates = local_dates(group)
            calendar_days = np.array([value.date().toordinal() for value in dates])
            intervals = np.diff(calendar_days)
            if not len(intervals) or intervals.mean() <= 0:
                continue
            median_interval = float(np.median(intervals))
            cv = float(intervals.std() / intervals.mean())
            amount = median_minor(abs(int(value)) for value in group.amount_minor)
            stable_amount = all(
                Decimal(abs(abs(int(value)) - amount))
                <= Decimal(amount) * Decimal(str(self.config.subscription_amount_tolerance))
                for value in group.amount_minor
            )
            evidence = common_evidence(group, txs) | {
                "merchant": str(group.iloc[0].merchant),
                "merchant_id": str(group.iloc[0].merchant_id),
                "median_interval_days": median_interval,
                "interval_cv": cv,
                "amount_minor": -amount,
                "first_charge_at": group.iloc[0].occurred_at.isoformat(),
                "last_charge_at": group.iloc[-1].occurred_at.isoformat(),
            }
            kind = None
            confidence = max(0.0, 1.0 - cv)
            # Fixed household bills are deliberately not optimization subscriptions.
            if (
                group.category.isin(["gym", "subscription"]).all()
                and self.config.subscription_interval_min
                <= median_interval
                <= self.config.subscription_interval_max
                and cv < self.config.subscription_interval_cv
                and stable_amount
                and (dates.max().date() - dates.min().date()).days
                >= self.config.subscription.min_history_days
            ):
                kind = "subscription"
                evidence["period"] = "monthly"
            elif group.spending_type.eq("discretionary").all():
                unique_dates = sorted(set(value.date() for value in dates))
                business_intervals = np.array(
                    [
                        np.busday_count(str(left), str(right))
                        for left, right in zip(unique_dates, unique_dates[1:])
                    ]
                )
                business_cv = (
                    float(business_intervals.std() / business_intervals.mean())
                    if len(business_intervals) and business_intervals.mean() > 0
                    else 1.0
                )
                weekdays = sum(value.weekday() < 5 for value in unique_dates)
                if (
                    len(unique_dates) >= self.config.default.min_support
                    and weekdays == len(unique_dates)
                    and np.median(business_intervals) == 1
                    and business_cv <= self.config.daily_interval_cv
                ):
                    kind = "daily_habit"
                    evidence["business_interval_cv"] = business_cv
                    confidence = 1.0 - business_cv
                elif (
                    self.config.weekly_interval_min <= median_interval <= self.config.weekly_interval_max
                    and cv <= self.config.weekly_interval_cv
                ):
                    kind = "weekly_habit"
                elif (
                    len(group) >= self.config.default.min_support
                    and monthly_total(group) >= self.config.default.min_impact_minor
                ):
                    # Irregular merchants are useful only when they repeat at least weekly.
                    if len(group) * 7 >= max(1, (dates.max().date() - dates.min().date()).days):
                        kind = "frequent_merchant"
                        confidence = 0.75
            if kind:
                evidence["consistent_months"] = evidence["months"]
                patterns.append(
                    Pattern(
                        kind,
                        evidence,
                        len(group),
                        confidence,
                        amount if kind == "subscription" else monthly_total(group),
                        period_of(group),
                        "recurring-v1",
                    )
                )
        return patterns
