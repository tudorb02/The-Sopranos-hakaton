from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

import yaml
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import func, select

from app.analytics.pipeline import AnalyticsPipeline
from app.db import Base, utcnow
from app.main import app
from app.models import Import, Merchant, MerchantAlias, Subscription, Transaction, User
from app.services.import_service import import_csv
from scripts.load_seed import load_persona
from tests_data import CSV_ONE

ROOT = Path(__file__).resolve().parents[2]
AS_OF = datetime(2026, 10, 31, 21, 59, 59, tzinfo=UTC)


def test_openapi_matches_committed_contract():
    contract = yaml.safe_load((ROOT / "api" / "openapi.yaml").read_text(encoding="utf-8"))
    assert contract == app.openapi(), "Run make openapi and commit api/openapi.yaml"


def test_migration_matches_metadata_and_downgrades(engine):
    with engine.begin() as connection:
        context = MigrationContext.configure(connection, opts={"compare_type": True})
        assert compare_metadata(context, Base.metadata) == []
        config = Config(str(ROOT / "alembic.ini"))
        config.set_main_option("script_location", str(ROOT / "backend" / "migrations"))
        config.attributes["connection"] = connection
        command.downgrade(config, "base")
        command.upgrade(config, "head")


def test_import_job_reimport_and_transaction_patch(client, headers, session):
    result = client.post(
        "/api/v1/accounts/import", files={"file": ("seed.csv", CSV_ONE, "text/csv")}, headers=headers
    )
    assert result.status_code == 202
    job = result.json()
    assert job["status"] == "completed" and job["inserted_count"] == 1
    assert client.get(f"/api/v1/imports/{job['id']}", headers=headers).json() == job
    duplicate = client.post(
        "/api/v1/accounts/import", files={"file": ("seed.csv", CSV_ONE)}, headers=headers
    ).json()
    assert duplicate["duplicate_count"] == 1 and duplicate["inserted_count"] == 0
    page = client.get("/api/v1/transactions?from=2026-10-12&to=2026-10-12", headers=headers).json()
    assert page["total"] == 1 and page["items"][0]["category"] == "coffee"
    tx = page["items"][0]
    assert tx["amount_minor"] == -3000 and tx["occurred_at"].endswith("Z")
    changed = client.patch(
        f"/api/v1/transactions/{tx['id']}", json={"category": "groceries"}, headers=headers
    )
    assert changed.status_code == 200 and changed.json()["spending_type"] == "essential"
    assert changed.json()["category_corrected"] is True
    assert client.get("/api/v1/transactions?category=coffee", headers=headers).json()["total"] == 0
    assert client.get("/api/v1/transactions?limit=1&offset=1", headers=headers).json()["items"] == []


def test_failed_csv_is_atomic_job_and_safe_error(client, headers, session):
    malformed = CSV_ONE + b"bad;line\n"
    response = client.post(
        "/api/v1/accounts/import", files={"file": ("private.csv", malformed)}, headers=headers
    )
    assert response.status_code == 202
    job = response.json()
    assert job["status"] == "failed" and job["error_code"] == "invalid_csv"
    assert "CAFENEA" not in job["error_message"]
    assert session.scalar(select(func.count()).select_from(Transaction)) == 0
    assert session.scalar(select(func.count()).select_from(Import)) == 1


def test_analysis_failure_rolls_back_import_and_records_failed_job(session, user, monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError("PRIVATE bank description")

    monkeypatch.setattr(AnalyticsPipeline, "run_full", fail)
    job = import_csv(session, user.id, CSV_ONE)
    assert job.status == "failed" and job.error_code == "import_failed"
    assert "PRIVATE" not in job.error_message
    assert session.scalar(select(func.count()).select_from(Transaction)) == 0
    assert session.scalar(select(func.count()).select_from(Merchant)) == 0


def test_tenant_isolation_all_reads_and_writes(client, session, user, headers):
    import_csv(session, user.id, CSV_ONE)
    tx = session.scalar(select(Transaction))
    job = session.scalar(select(Import))
    other = User(name="Alt utilizator fictiv")
    session.add(other)
    session.commit()
    other_headers = {"X-User-Id": str(other.id)}
    assert client.get("/api/v1/transactions", headers=other_headers).json()["total"] == 0
    assert client.get(f"/api/v1/imports/{job.id}", headers=other_headers).status_code == 404
    assert (
        client.patch(
            f"/api/v1/transactions/{tx.id}", json={"category": "coffee"}, headers=other_headers
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/api/v1/accounts/import",
            files={"file": ("x.csv", CSV_ONE)},
            data={"account_id": str(tx.account_id)},
            headers=other_headers,
        ).status_code
        == 404
    )
    for path in ["analytics/recurring", "insights", "subscriptions"]:
        assert client.get("/api/v1/" + path, headers=other_headers).json() == []


def test_analytics_endpoints_and_insight_feedback(client, session):
    user_id, _ = load_persona(session, ROOT / "backend/seed/output/daily_coffee", AS_OF)
    headers = {"X-User-Id": str(user_id)}
    summary = client.get("/api/v1/analytics/summary?period=all", headers=headers)
    assert summary.status_code == 200 and summary.json()["income_minor"] > 0
    assert summary.json()["expenses_minor"] < 0
    flow = client.get("/api/v1/analytics/cashflow?months=6", headers=headers)
    assert flow.status_code == 200 and flow.json()["points"]
    recurring = client.get("/api/v1/analytics/recurring", headers=headers).json()
    assert any(pattern["type"] == "daily_habit" for pattern in recurring)
    insights = client.get("/api/v1/insights?status=new", headers=headers).json()
    assert insights
    result = client.patch(f"/api/v1/insights/{insights[0]['id']}", json={"status": "seen"}, headers=headers)
    assert result.status_code == 200 and result.json()["status"] == "seen"
    stranger = User(name="Străin fictiv")
    session.add(stranger)
    session.commit()
    assert (
        client.patch(
            f"/api/v1/insights/{insights[0]['id']}",
            json={"status": "accepted"},
            headers={"X-User-Id": str(stranger.id)},
        ).status_code
        == 404
    )


def test_subscription_usage_source_requires_explicit_connection_and_is_idempotent(client, session):
    user_id, _ = load_persona(session, ROOT / "backend/seed/output/unused_gym", AS_OF)
    headers = {"X-User-Id": str(user_id)}
    subscription = client.get("/api/v1/subscriptions", headers=headers).json()[0]
    assert subscription["usage_source"] == "geofence"
    sid = subscription["id"]
    source = client.patch(
        f"/api/v1/subscriptions/{sid}",
        json={"usage_source": "manual", "usage_connected_at": (utcnow() - timedelta(days=60)).isoformat()},
        headers=headers,
    )
    assert source.status_code == 200
    body = {
        "subscription_id": sid,
        "source": "manual",
        "occurred_at": (utcnow() - timedelta(hours=1)).isoformat(),
    }
    first = client.post("/api/v1/usage-signals", json=body, headers=headers)
    second = client.post("/api/v1/usage-signals", json=body, headers=headers)
    assert first.status_code == second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert client.get("/api/v1/subscriptions", headers=headers).json()[0]["usage_count_30_days"] == 1
    assert not any(
        insight["type"] == "unused_subscription"
        for insight in client.get("/api/v1/insights", headers=headers).json()
    )
    result = client.patch(f"/api/v1/subscriptions/{sid}", json={"status": "cancel_planned"}, headers=headers)
    assert result.status_code == 200 and result.json()["status"] == "cancel_planned"
    # Re-analysis preserves explicit user choices.
    AnalyticsPipeline(session).run_full(user_id, AS_OF)
    assert session.get(Subscription, UUID(sid)).status == "cancel_planned"


def test_manual_alias_overrides_rules_and_is_cached(session, user):
    merchant = Merchant(name_normalized="CAFENEA X", category_default="coffee")
    session.add(merchant)
    session.flush()
    session.add(MerchantAlias(alias="CAFENEA X", merchant_id=merchant.id, category_override="groceries"))
    session.commit()
    assert import_csv(session, user.id, CSV_ONE).status == "completed"
    assert session.scalar(select(Transaction)).category == "groceries"


def test_error_contract_validation_and_missing_identity(client, headers):
    assert client.get("/api/v1/transactions").status_code == 422
    assert client.get("/api/v1/transactions", headers={"X-User-Id": str(uuid4())}).status_code == 404
    for path in [
        "transactions?limit=0",
        "analytics/cashflow?months=0",
        "analytics/summary?period=invalid",
        "transactions?currency=ron",
        "transactions/not-a-uuid",
    ]:
        response = client.get("/api/v1/" + path, headers=headers)
        assert response.status_code in (404, 405, 422)
        assert set(response.json()) == {"error"}
    assert (
        client.get("/api/v1/transactions?from=2026-10-12&to=2026-10-01", headers=headers).status_code == 400
    )
    assert (
        client.patch(
            f"/api/v1/transactions/{uuid4()}", json={"category": "invalid"}, headers=headers
        ).status_code
        == 422
    )
    assert client.patch(f"/api/v1/subscriptions/{uuid4()}", json={}, headers=headers).status_code == 422


def test_upload_limit_and_account_currency_mismatch(client, session, user, headers, monkeypatch):
    from app.api import routes

    import_csv(session, user.id, CSV_ONE)
    tx = session.scalar(select(Transaction))
    response = client.post(
        "/api/v1/accounts/import",
        files={"file": ("x.csv", CSV_ONE)},
        data={"account_id": str(tx.account_id), "currency": "EUR"},
        headers=headers,
    )
    assert response.status_code == 400 and "error" in response.json()
    monkeypatch.setattr(routes, "MAX_IMPORT_BYTES", 16)
    response = client.post("/api/v1/accounts/import", files={"file": ("x.csv", CSV_ONE)}, headers=headers)
    assert response.status_code == 413 and "error" in response.json()


def test_usage_and_subscription_tenant_isolation_and_validation(client, session):
    user_id, _ = load_persona(session, ROOT / "backend/seed/output/unused_gym", AS_OF)
    subscription = session.scalar(select(Subscription).where(Subscription.user_id == user_id))
    stranger = User(name="Alt utilizator fictiv")
    session.add(stranger)
    session.commit()
    other_headers = {"X-User-Id": str(stranger.id)}
    headers = {"X-User-Id": str(user_id)}
    sid = str(subscription.id)
    body = {"subscription_id": sid, "source": "manual", "occurred_at": utcnow().isoformat()}
    assert client.post("/api/v1/usage-signals", json=body, headers=other_headers).status_code == 404
    assert (
        client.patch(
            f"/api/v1/subscriptions/{sid}", json={"status": "cancelled"}, headers=other_headers
        ).status_code
        == 404
    )
    body["occurred_at"] = (utcnow() + timedelta(days=1)).isoformat()
    assert client.post("/api/v1/usage-signals", json=body, headers=headers).status_code == 400
    body["occurred_at"] = "2026-10-01T08:00:00"
    assert client.post("/api/v1/usage-signals", json=body, headers=headers).status_code == 422
    assert (
        client.patch(
            f"/api/v1/subscriptions/{sid}", json={"usage_source": "health"}, headers=headers
        ).status_code
        == 422
    )


def test_cold_start_summary_is_explicit(client, headers):
    result = client.get("/api/v1/analytics/summary", headers=headers).json()
    assert result["history"]["sufficient"] is False
    assert result["history"]["history_days"] == 0
    assert "nevoie de date" in result["history"]["message"]
