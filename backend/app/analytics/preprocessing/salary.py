from collections import Counter
from dataclasses import dataclass
from decimal import Decimal

import pandas as pd

from app.analytics.config import CONFIG, AnalyticsConfig
from app.analytics.preprocessing.timestamps import BUCHAREST


def median_minor(values) -> int:
    ordered = sorted(int(value) for value in values)
    count = len(ordered)
    if not count:
        return 0
    return ordered[count // 2] if count % 2 else (ordered[count // 2 - 1] + ordered[count // 2]) // 2


@dataclass(frozen=True)
class SalaryEstimate:
    salary_day: int
    monthly_income_minor: int


def detect_salary(txs: pd.DataFrame, config: AnalyticsConfig = CONFIG) -> SalaryEstimate | None:
    if txs.empty:
        return None
    candidates = []
    for _, group in txs[txs.amount_minor > 0].groupby("merchant"):
        group = group.sort_values("occurred_at")
        dates = pd.to_datetime(group.occurred_at, utc=True).dt.tz_convert(BUCHAREST)
        if len(group) < config.subscription.min_support or dates.dt.strftime("%Y-%m").nunique() < 3:
            continue
        intervals = dates.diff().dropna().dt.total_seconds() / 86400
        if not intervals.between(config.salary_interval_min, config.salary_interval_max).all():
            continue
        amount = median_minor(group.amount_minor)
        if any(
            Decimal(abs(int(value) - amount)) > Decimal(amount) * Decimal(str(config.salary_amount_tolerance))
            for value in group.amount_minor
        ):
            continue
        # The modal nominal day resists the preceding-Friday weekend adjustment.
        day = Counter(dates.dt.day).most_common(1)[0][0]
        candidates.append(SalaryEstimate(int(day), amount))
    return max(candidates, key=lambda estimate: estimate.monthly_income_minor, default=None)
