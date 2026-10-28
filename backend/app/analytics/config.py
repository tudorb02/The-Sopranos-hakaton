from dataclasses import dataclass, field


@dataclass(frozen=True)
class Thresholds:
    min_support: int = 8
    min_weeks: int = 3
    min_history_days: int = 60
    min_impact_minor: int = 5000
    alpha: float = 0.05
    min_consistent_months: int = 2


@dataclass(frozen=True)
class AnalyticsConfig:
    default: Thresholds = field(default_factory=Thresholds)
    subscription: Thresholds = field(default_factory=lambda: Thresholds(min_support=3))
    shortage: Thresholds = field(default_factory=lambda: Thresholds(min_support=2))
    fuzzy_score: int = 90
    subscription_interval_min: int = 28
    subscription_interval_max: int = 31
    subscription_interval_cv: float = 0.15
    subscription_amount_tolerance: float = 0.05
    salary_amount_tolerance: float = 0.15
    salary_interval_min: int = 25
    salary_interval_max: int = 35
    daily_interval_cv: float = 0.35
    weekly_interval_cv: float = 0.20
    weekly_interval_min: int = 6
    weekly_interval_max: int = 8
    early_spending_days: int = 7
    cycle_tail_days: int = 7
    critical_floor_minor: int = 10000
    critical_income_share_percent: int = 10
    critical_days: int = 3
    cycle_window: int = 3
    min_affected_cycles: int = 2
    usage_window_days: int = 30
    max_new_insights_per_week: int = 5
    active_hour_start: int = 7
    active_hour_end: int = 24
    time_windows: tuple[tuple[int, int], ...] = ((7, 10), (10, 14), (14, 18), (18, 22), (22, 2))

    def for_pattern(self, pattern_type: str) -> Thresholds:
        if pattern_type in {"subscription", "unused_subscription"}:
            return self.subscription
        if pattern_type == "end_of_cycle_shortage":
            return self.shortage
        return self.default


CONFIG = AnalyticsConfig()
