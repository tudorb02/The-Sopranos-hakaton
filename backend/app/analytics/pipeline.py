"""Database orchestration. Detectors themselves only receive immutable snapshots."""

from dataclasses import replace
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal
from uuid import UUID

from dateutil.relativedelta import relativedelta
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.analytics.config import CONFIG, AnalyticsConfig
from app.analytics.detectors import DETECTORS
from app.analytics.detectors.base import SubscriptionSnapshot, UsageSnapshot, UserProfile, period_of
from app.analytics.preprocessing.salary import detect_salary
from app.analytics.preprocessing.timestamps import BUCHAREST, local_to_utc
from app.analytics.ranker import fingerprint, rank, score
from app.analytics.validation import validate
from app.db import SessionLocal, utcnow
from app.models import Account, Insight, Merchant, Pattern, Subscription, Transaction, UsageSignal, User
from app.services.analytics_service import get_user, load_frame

INSIGHT_TYPES = {
    "end_of_cycle_shortage": "end_of_month_shortage",
    "unused_subscription": "unused_subscription",
    "subscription": "recurring_expense",
    "daily_habit": "recurring_expense",
    "weekly_habit": "recurring_expense",
    "frequent_merchant": "recurring_expense",
    "morning_spending": "recurring_expense",
    "time_window_spending": "recurring_expense",
}


class AnalyticsPipeline:
    def __init__(self, session: Session, config: AnalyticsConfig = CONFIG):
        self.session = session
        self.config = config

    def run_full(self, user_id: UUID, as_of: datetime | None = None) -> list[Pattern]:
        session = self.session
        as_of = as_of or utcnow()
        # Serialize imports/analysis for the same user; safe no-op on SQLite tests.
        session.scalar(select(User).where(User.id == user_id).with_for_update())
        user = get_user(session, user_id)
        currencies = list(
            session.scalars(select(Account.currency).where(Account.user_id == user_id).distinct())
        )
        old = list(session.scalars(select(Pattern).where(Pattern.user_id == user_id)))
        stored = {row.fingerprint: row for row in old}
        insights = {
            row.pattern_id: row for row in session.scalars(select(Insight).where(Insight.user_id == user_id))
        }
        statuses = {row.fingerprint: insights[row.id].status for row in old if row.id in insights}
        for row in old:
            row.active = False
        session.execute(
            update(Transaction)
            .where(Transaction.account_id.in_(select(Account.id).where(Account.user_id == user_id)))
            .values(is_recurring=False)
        )
        profile = UserProfile(
            as_of,
            user.salary_day,
            user.monthly_income_minor,
            user.currency,
            tuple(user.declared_problems),
            previous_statuses=statuses,
        )
        candidates = []
        detectors = [type(detector)(self.config) for detector in DETECTORS]
        recurring_detector = next(detector for detector in detectors if detector.name == "recurring")
        for currency in sorted(currencies):
            frame = load_frame(session, user_id, currency, as_of)
            if frame.empty:
                continue
            current_profile = replace(profile, currency=currency)
            salary = detect_salary(frame, self.config)
            if salary:
                current_profile = replace(
                    current_profile,
                    salary_day=user.salary_day or salary.salary_day,
                    monthly_income_minor=(user.monthly_income_minor if currency == user.currency else None)
                    or salary.monthly_income_minor,
                )
                if currency == user.currency:
                    user.salary_day = current_profile.salary_day
                    user.monthly_income_minor = current_profile.monthly_income_minor
            elif currency != user.currency:
                current_profile = replace(current_profile, monthly_income_minor=None)
            recurring = [
                pattern
                for pattern in recurring_detector.detect(frame, current_profile)
                if validate(pattern, self.config)
            ]
            for pattern in recurring:
                merchant_id = UUID(pattern.evidence["merchant_id"])
                session.execute(
                    update(Transaction)
                    .where(
                        Transaction.account_id.in_(select(Account.id).where(Account.user_id == user_id)),
                        Transaction.merchant_id == merchant_id,
                        Transaction.currency == currency,
                        Transaction.amount_minor < 0,
                    )
                    .values(is_recurring=True)
                )
                if pattern.type == "subscription":
                    subscription = session.scalar(
                        select(Subscription).where(
                            Subscription.user_id == user_id,
                            Subscription.merchant_id == merchant_id,
                            Subscription.currency == currency,
                        )
                    )
                    last_charge = datetime.fromisoformat(pattern.evidence["last_charge_at"])
                    # Calendar-month arithmetic in the payment timezone, including DST.
                    next_charge = (last_charge.astimezone(BUCHAREST) + relativedelta(months=1)).astimezone(
                        UTC
                    )
                    if subscription is None:
                        subscription = Subscription(
                            user_id=user_id,
                            merchant_id=merchant_id,
                            currency=currency,
                            amount_minor=pattern.evidence["amount_minor"],
                            last_charge_at=last_charge,
                            next_charge_at=next_charge,
                        )
                        session.add(subscription)
                    else:
                        subscription.amount_minor = pattern.evidence["amount_minor"]
                        subscription.last_charge_at = last_charge
                        subscription.next_charge_at = next_charge
            session.flush()
            snapshots = self._subscriptions(user_id, currency)
            current_profile = replace(current_profile, subscriptions=snapshots[0], usage_signals=snapshots[1])
            candidates.extend(recurring)
            history_start, history_end = period_of(frame)
            for detector in detectors:
                if (
                    detector.name == "recurring"
                    or (history_end - history_start).days < detector.min_history_days
                ):
                    continue
                candidates.extend(
                    pattern
                    for pattern in detector.detect(frame, current_profile)
                    if validate(pattern, self.config)
                )
        persisted = []
        ranked = rank(candidates, profile)
        week = as_of.astimezone(BUCHAREST).date()
        week -= timedelta(days=week.weekday())
        week_start = local_to_utc(datetime.combine(week, time.min))
        week_end = local_to_utc(datetime.combine(week + timedelta(days=7), time.min))
        created_this_week = sum(week_start <= row.created_at < week_end for row in insights.values())
        for candidate in ranked:
            key = fingerprint(candidate)
            row = stored.get(key)
            if row is None:
                row = Pattern(user_id=user_id, fingerprint=key)
                session.add(row)
                stored[key] = row
            row.type = candidate.type
            row.evidence = candidate.evidence
            row.support = candidate.support
            row.confidence = Decimal(str(candidate.confidence))
            row.monthly_impact_minor = candidate.monthly_impact_minor
            row.currency = candidate.evidence["currency"]
            row.period_start = local_to_utc(datetime.combine(candidate.period[0], time.min))
            row.period_end = local_to_utc(datetime.combine(candidate.period[1], time.min))
            row.detector_version = candidate.detector_version
            row.active = True
            row.updated_at = as_of
            session.flush()
            insight = insights.get(row.id)
            if insight is None and created_this_week < self.config.max_new_insights_per_week:
                insight = Insight(
                    user_id=user_id,
                    pattern_id=row.id,
                    type=INSIGHT_TYPES.get(candidate.type, candidate.type),
                    status="new",
                    created_at=as_of,
                )
                session.add(insight)
                insights[row.id] = insight
                created_this_week += 1
            if insight:
                insight.payload = {
                    "pattern_type": row.type,
                    "evidence": row.evidence,
                    "monthly_impact_minor": row.monthly_impact_minor,
                    "currency": row.currency,
                    "confidence": float(row.confidence),
                    "support": row.support,
                }
                insight.score = score(candidate, profile)
            persisted.append(row)
        session.flush()
        return persisted

    def _subscriptions(self, user_id, currency):
        pairs = self.session.execute(
            select(Subscription, Merchant.name_normalized)
            .join(Merchant, Subscription.merchant_id == Merchant.id)
            .where(Subscription.user_id == user_id, Subscription.currency == currency)
        ).all()
        subscriptions = tuple(
            SubscriptionSnapshot(
                name,
                str(sub.merchant_id),
                sub.amount_minor,
                sub.currency,
                sub.status,
                sub.last_charge_at,
                sub.usage_source,
                sub.usage_connected_at,
            )
            for sub, name in pairs
        )
        merchant_ids = {sub.id: str(sub.merchant_id) for sub, _ in pairs}
        signals = tuple(
            UsageSnapshot(merchant_ids[signal.subscription_id], signal.source, signal.occurred_at)
            for signal in self.session.scalars(select(UsageSignal).where(UsageSignal.user_id == user_id))
            if signal.subscription_id in merchant_ids
        )
        return subscriptions, signals

    def run_incremental(self, transaction_id: UUID, as_of: datetime | None = None) -> list[Pattern]:
        user_id = self.session.scalar(
            select(Account.user_id).join(Transaction).where(Transaction.id == transaction_id)
        )
        if user_id is None:
            raise LookupError("Tranzacția nu există.")
        return self.run_full(user_id, as_of)


def run_full(user_id: UUID, *, session: Session | None = None, as_of: datetime | None = None):
    if session is not None:
        return AnalyticsPipeline(session).run_full(user_id, as_of)
    with SessionLocal.begin() as db:
        return AnalyticsPipeline(db).run_full(user_id, as_of)


def run_incremental(transaction_id: UUID, *, session: Session | None = None, as_of: datetime | None = None):
    if session is not None:
        return AnalyticsPipeline(session).run_incremental(transaction_id, as_of)
    with SessionLocal.begin() as db:
        return AnalyticsPipeline(db).run_incremental(transaction_id, as_of)
