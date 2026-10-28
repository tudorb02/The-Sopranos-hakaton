from datetime import timedelta

import pandas as pd

from app.analytics.config import CONFIG, AnalyticsConfig
from app.analytics.detectors.base import Pattern, UserProfile, common_evidence, period_of


class UnusedSubscriptionDetector:
    name = "unused_subscription"
    min_history_days = CONFIG.subscription.min_history_days

    def __init__(self, config: AnalyticsConfig = CONFIG):
        self.config = config
        self.min_history_days = config.subscription.min_history_days

    def detect(self, txs: pd.DataFrame, profile: UserProfile) -> list[Pattern]:
        if txs.empty:
            return []
        cutoff = profile.as_of - timedelta(days=self.config.usage_window_days)
        result = []
        for subscription in profile.subscriptions:
            if (
                subscription.status != "active"
                or not subscription.usage_source
                or not subscription.usage_connected_at
                or subscription.usage_connected_at > cutoff
                or subscription.last_charge_at < cutoff
            ):
                continue
            signals = [
                signal
                for signal in profile.usage_signals
                if signal.merchant_id == subscription.merchant_id
                and signal.source == subscription.usage_source
                and cutoff <= signal.occurred_at <= profile.as_of
            ]
            if signals:
                continue
            group = txs[
                (txs.merchant_id == subscription.merchant_id)
                & (txs.amount_minor < 0)
                & (txs.currency == subscription.currency)
            ]
            if group.empty:
                continue
            evidence = common_evidence(group, txs) | {
                "merchant": subscription.merchant,
                "merchant_id": subscription.merchant_id,
                "usage_source": subscription.usage_source,
                "usage_count": 0,
                "window_days": self.config.usage_window_days,
                "cost_per_use_minor": None,
                "consistent_months": common_evidence(group, txs)["months"],
                "monitoring_connected_at": subscription.usage_connected_at.isoformat(),
            }
            result.append(
                Pattern(
                    "unused_subscription",
                    evidence,
                    len(group),
                    1.0,
                    abs(subscription.amount_minor),
                    period_of(group),
                    "unused-v1",
                )
            )
        return result
