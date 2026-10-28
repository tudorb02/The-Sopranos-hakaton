import math

from app.analytics.config import CONFIG, AnalyticsConfig
from app.analytics.detectors.base import Pattern


def validate(pattern: Pattern, config: AnalyticsConfig = CONFIG) -> bool:
    threshold = config.for_pattern(pattern.type)
    evidence = pattern.evidence
    return (
        isinstance(pattern.monthly_impact_minor, int)
        and pattern.monthly_impact_minor >= threshold.min_impact_minor
        and pattern.support >= threshold.min_support
        and evidence.get("weeks", 0) >= threshold.min_weeks
        and evidence.get("history_days", 0) >= threshold.min_history_days
        and math.isfinite(pattern.confidence)
        and 0 <= pattern.confidence <= 1
        and (
            evidence.get("p_value", 1) < threshold.alpha
            or evidence.get("consistent_months", 0) >= threshold.min_consistent_months
        )
    )
