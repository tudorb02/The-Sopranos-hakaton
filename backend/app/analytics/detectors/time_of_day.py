import pandas as pd
from scipy.stats import binomtest

from app.analytics.config import CONFIG, AnalyticsConfig
from app.analytics.detectors.base import (
    Pattern,
    UserProfile,
    common_evidence,
    local_dates,
    monthly_total,
    period_of,
)


class TimeOfDayDetector:
    name = "time_of_day"
    min_history_days = CONFIG.default.min_history_days

    def __init__(self, config: AnalyticsConfig = CONFIG):
        self.config = config
        self.min_history_days = config.default.min_history_days

    def detect(self, txs: pd.DataFrame, profile: UserProfile) -> list[Pattern]:
        if txs.empty:
            return []
        eligible = txs[
            (txs.amount_minor < 0)
            & (txs.spending_type == "discretionary")
            & (txs.occurred_at_precision == "minute")
        ]
        if len(eligible) < self.config.default.min_support:
            return []
        hours = local_dates(eligible).dt.hour
        windows = self.config.time_windows
        patterns = []
        for start, end in windows:
            mask = ((hours >= start) & (hours < end)) if end > start else ((hours >= start) | (hours < end))
            group = eligible[mask]
            active_hours = range(self.config.active_hour_start, self.config.active_hour_end)
            covered = sum(
                (start <= hour < end) if end > start else (hour >= start or hour < end)
                for hour in active_hours
            )
            baseline = covered / len(active_hours)
            p_value = min(
                1.0,
                binomtest(len(group), len(eligible), baseline, alternative="greater").pvalue * len(windows),
            )
            if len(group) < self.config.default.min_support or p_value >= self.config.default.alpha:
                continue
            morning = start == 7 and end == 10
            evidence = common_evidence(group, txs) | {
                "window": f"{start:02}:00–{end:02}:00",
                "count": len(group),
                "total": len(eligible),
                "share": len(group) / len(eligible),
                "baseline": baseline,
                "p_value": p_value,
                "before_hour": 10 if morning else None,
            }
            patterns.append(
                Pattern(
                    "morning_spending" if morning else "time_window_spending",
                    evidence,
                    len(group),
                    1.0 - p_value,
                    monthly_total(group),
                    period_of(group),
                    "time-of-day-v1",
                )
            )
        return patterns
