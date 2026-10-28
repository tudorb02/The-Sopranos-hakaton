from datetime import timedelta
from decimal import Decimal

import pandas as pd

from app.analytics.config import CONFIG, AnalyticsConfig
from app.analytics.detectors.base import Pattern, UserProfile, common_evidence, local_dates, period_of
from app.analytics.ledger import daily_balances


class PaydayCycleDetector:
    name = "payday_cycle"
    min_history_days = CONFIG.shortage.min_history_days

    def __init__(self, config: AnalyticsConfig = CONFIG):
        self.config = config
        self.min_history_days = config.shortage.min_history_days

    def detect(self, txs: pd.DataFrame, profile: UserProfile) -> list[Pattern]:
        if txs.empty or not profile.monthly_income_minor or not profile.salary_day:
            return []
        income = profile.monthly_income_minor
        # Confirmed salary receipts define complete cycles, including weekend shifts.
        credits = txs[(txs.amount_minor > 0) & (txs.currency == profile.currency)]
        salary = credits[
            credits.amount_minor.map(
                lambda value: Decimal(abs(int(value) - income))
                <= Decimal(income) * Decimal(str(self.config.salary_amount_tolerance))
            )
        ]
        paydays = sorted(set(value.date() for value in local_dates(salary)))
        balances = daily_balances(txs)
        cycles = []
        threshold = max(
            self.config.critical_floor_minor, income * self.config.critical_income_share_percent // 100
        )
        occurred = local_dates(txs).dt.date
        for start, next_start in zip(paydays, paydays[1:]):
            if (
                not self.config.salary_interval_min
                <= (next_start - start).days
                <= self.config.salary_interval_max
            ):
                continue
            days = [start + timedelta(days=index) for index in range((next_start - start).days)]
            if not all(day in balances for day in days):
                continue
            tail = days[-self.config.cycle_tail_days :]
            critical = sum(balances[day] < threshold for day in tail)
            early = txs[
                (occurred >= start)
                & (occurred < start + timedelta(days=self.config.early_spending_days))
                & (txs.amount_minor < 0)
            ]
            spent = sum(-int(value) for value in early.amount_minor)
            cycles.append((critical, spent, [balances[day] for day in days]))
        cycles = cycles[-self.config.cycle_window :]
        affected = sum(critical >= self.config.critical_days for critical, _, _ in cycles)
        if affected < self.config.min_affected_cycles:
            return []
        evidence = common_evidence(txs, txs) | {
            "cycles_affected": affected,
            "cycles_total": len(cycles),
            "consistent_months": affected,
            "critical_threshold_minor": threshold,
            "avg_critical_days": sum(value[0] for value in cycles) / len(cycles),
            f"spent_first_{self.config.early_spending_days}_days_share": sum(value[1] for value in cycles)
            / (len(cycles) * income),
            "average_balance_curve_minor": [
                sum(curve[day] for _, _, curve in cycles if len(curve) > day)
                // sum(len(curve) > day for _, _, curve in cycles)
                for day in range(max(len(curve) for _, _, curve in cycles))
            ],
        }
        return [
            Pattern(
                "end_of_cycle_shortage",
                evidence,
                affected,
                affected / len(cycles),
                threshold,
                period_of(txs),
                "payday-v1",
            )
        ]
