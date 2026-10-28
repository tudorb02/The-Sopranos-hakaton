import json
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import func, select

from app.analytics.config import CONFIG
from app.analytics.detectors.base import Pattern as Candidate
from app.analytics.detectors.base import UserProfile
from app.analytics.pipeline import AnalyticsPipeline
from app.analytics.ranker import fingerprint, rank, score
from app.analytics.validation import validate
from app.models import Insight, Pattern, Subscription, Transaction
from app.services.analytics_service import get_cashflow_pattern, get_spending_summary
from app.services.import_service import import_csv
from scripts.load_seed import load_persona

ROOT = Path(__file__).resolve().parents[1] / "seed" / "output"
AS_OF = datetime(2026, 10, 31, 21, 59, 59, tzinfo=UTC)
PERSONAS = ["end_of_month", "daily_coffee", "unused_gym", "birthday_month", "goal_2000", "balanced"]


@pytest.mark.parametrize("persona", PERSONAS)
def test_full_pipeline_matches_in_scope_persona_expectations(session, persona):
    directory = ROOT / persona
    user_id, patterns = load_persona(session, directory, AS_OF)
    expected = json.loads((directory / "expected_patterns.json").read_text())
    for target in expected:
        if target["type"] == "upcoming_spike":
            continue  # Explicitly exercised by the strict xfail below, not silently ignored.
        matched = [
            pattern
            for pattern in patterns
            if pattern.type == target["type"]
            and (not target.get("merchant") or pattern.evidence.get("merchant") == target["merchant"])
            and (not target.get("window") or pattern.evidence.get("window") == target["window"])
        ]
        assert matched, (persona, target, [pattern.type for pattern in patterns])
        if "min_confidence" in target:
            assert max(pattern.confidence for pattern in matched) >= Decimal(str(target["min_confidence"]))
    if persona == "balanced":
        assert patterns == []
        assert not session.scalars(select(Insight).where(Insight.user_id == user_id)).all()
    manifest = json.loads((ROOT / "manifest.json").read_text())
    summary = next(item for item in manifest["personas"] if item["persona_id"] == persona)
    assert session.scalar(select(func.count()).select_from(Transaction)) == summary["transaction_count"]
    result = get_spending_summary(session, user_id, "all", as_of=AS_OF)
    assert result["income_minor"] == summary["income_minor"]
    assert result["expenses_minor"] == -summary["expenses_minor"]
    flow = get_cashflow_pattern(session, user_id, 6, as_of=AS_OF)
    assert flow["points"][-1]["balance_minor"] == summary["closing_balance_minor"]
    if persona == "unused_gym":
        assert len(session.scalars(select(Subscription)).all()) == 1


@pytest.mark.xfail(
    strict=True, reason="Calendar integration and upcoming_spike are explicitly outside steps 3–7"
)
def test_birthday_upcoming_spike_requires_future_calendar_work(session):
    _, patterns = load_persona(session, ROOT / "birthday_month", AS_OF)
    target = next(
        item
        for item in json.loads((ROOT / "birthday_month" / "expected_patterns.json").read_text())
        if item["type"] == "upcoming_spike"
    )
    assert any(pattern.type == target["type"] for pattern in patterns)


def test_reimport_incremental_preserve_ids_and_user_feedback(session):
    user_id, patterns = load_persona(session, ROOT / "daily_coffee", AS_OF)
    ids = {pattern.id for pattern in patterns}
    insight = session.scalar(select(Insight).where(Insight.user_id == user_id))
    insight.status = "dismissed"
    session.commit()
    insight_id = insight.id
    initial_count = session.scalar(select(func.count()).select_from(Transaction))
    job = import_csv(session, user_id, (ROOT / "daily_coffee" / "transactions.csv").read_bytes(), as_of=AS_OF)
    assert job.status == "completed" and job.inserted_count == 0 and job.duplicate_count == initial_count
    assert session.scalar(select(func.count()).select_from(Transaction)) == initial_count
    assert session.get(Insight, insight_id).status == "dismissed"
    tx = session.scalar(select(Transaction))
    assert {pattern.id for pattern in AnalyticsPipeline(session).run_incremental(tx.id, AS_OF)} == ids
    assert session.scalar(select(func.count()).select_from(Insight)) == len(ids)


def candidate(kind="daily_habit", impact=10000):
    return Candidate(
        kind,
        {"currency": "RON", "weeks": 8, "history_days": 100, "consistent_months": 3},
        20,
        0.98,
        impact,
        (AS_OF.date() - timedelta(days=100), AS_OF.date()),
        "test-v1",
    )


@pytest.mark.parametrize("change", ["support", "weeks", "history", "impact", "significance", "confidence"])
def test_validator_rejects_noise(change):
    pattern = candidate()
    assert validate(pattern)
    if change == "support":
        pattern.support = 7
    elif change == "weeks":
        pattern.evidence["weeks"] = 2
    elif change == "history":
        pattern.evidence["history_days"] = 59
    elif change == "impact":
        pattern.monthly_impact_minor = 4999
    elif change == "significance":
        pattern.evidence["consistent_months"] = 1
    else:
        pattern.confidence = float("nan")
    assert not validate(pattern)


def test_ranker_exact_formula_novelty_relevance_and_determinism():
    pattern = candidate()
    profile = UserProfile(AS_OF)
    assert score(pattern, profile) == Decimal("0.98")
    relevant = replace(profile, declared_problems=("Nu știu unde se duc banii",))
    assert score(pattern, relevant) == Decimal("1.470")
    seen = replace(relevant, previous_statuses={fingerprint(pattern): "seen"})
    assert score(pattern, seen) == Decimal("0.7350")
    dismissed = replace(relevant, previous_statuses={fingerprint(pattern): "dismissed"})
    assert score(pattern, dismissed) < score(pattern, seen)
    assert rank([candidate(impact=20000), pattern], profile)[0].monthly_impact_minor == 20000


def test_weekly_limit_and_stale_patterns(session):
    user_id, _ = load_persona(session, ROOT / "daily_coffee", AS_OF)
    session.query(Insight).delete()
    session.commit()
    config = replace(CONFIG, max_new_insights_per_week=1)
    pipeline = AnalyticsPipeline(session, config)
    patterns = pipeline.run_full(user_id, AS_OF)
    session.commit()
    assert len(patterns) == 2 and session.scalar(select(func.count()).select_from(Insight)) == 1
    pipeline.run_full(user_id, AS_OF)
    session.commit()
    assert session.scalar(select(func.count()).select_from(Insight)) == 1
    pipeline.run_full(user_id, AS_OF + timedelta(days=8))
    session.commit()
    assert session.scalar(select(func.count()).select_from(Insight)) == 2
    for transaction in session.scalars(select(Transaction)):
        transaction.spending_type = "essential"
    session.flush()
    assert pipeline.run_full(user_id, AS_OF) == []
    assert not session.scalars(select(Pattern).where(Pattern.active.is_(True))).all()


def test_no_cross_currency_money_totals_or_patterns(session, user):
    from tests_data import CSV_ONE

    ron = import_csv(session, user.id, CSV_ONE, currency="RON", as_of=AS_OF)
    eur = import_csv(session, user.id, CSV_ONE, currency="EUR", as_of=AS_OF)
    assert ron.status == eur.status == "completed"
    assert get_spending_summary(session, user.id, "all", "RON", AS_OF)["expenses_minor"] == -3000
    assert get_spending_summary(session, user.id, "all", "EUR", AS_OF)["expenses_minor"] == -3000
    assert get_spending_summary(session, user.id, "all", "USD", AS_OF)["expenses_minor"] == 0


def test_import_estimates_salary_without_seed_profile(session, user):
    job = import_csv(session, user.id, (ROOT / "daily_coffee" / "transactions.csv").read_bytes(), as_of=AS_OF)
    assert job.status == "completed"
    session.refresh(user)
    assert user.salary_day == 5 and user.monthly_income_minor == 650000


def test_large_money_never_loses_precision(session, user):
    from tests_data import CSV_ONE

    # Above IEEE-754's exact integer range, while still within signed BIGINT.
    amount = 9007199254740993
    data = CSV_ONE.replace(b"30,00;;1000,00", b"90071992547409,93;;90071992547409,94")
    job = import_csv(session, user.id, data, as_of=AS_OF)
    assert job.status == "completed"
    row = session.scalar(select(Transaction))
    assert row.amount_minor == -amount and row.balance_minor == amount + 1
    summary = get_spending_summary(session, user.id, "all", as_of=AS_OF)
    assert summary["expenses_minor"] == -amount and summary["categories"]["coffee"] == -amount


def test_cashflow_uses_selected_currency_threshold(session, user):
    from tests_data import CSV_ONE

    user.monthly_income_minor = 650000
    session.commit()
    import_csv(session, user.id, CSV_ONE, currency="EUR", as_of=AS_OF)
    cashflow = get_cashflow_pattern(session, user.id, currency="EUR", as_of=AS_OF)
    assert cashflow["critical_threshold_minor"] == CONFIG.critical_floor_minor
    assert cashflow["salary_day"] is None
