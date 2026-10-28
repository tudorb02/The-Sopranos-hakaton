"""Load existing fixtures; this does not generate or alter mock data."""

import argparse
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select

from app.analytics.pipeline import AnalyticsPipeline
from app.db import SessionLocal
from app.models import Subscription, UsageSignal, User
from app.services.import_service import import_csv

ROOT = Path(__file__).resolve().parents[1] / "seed" / "output"


def load_persona(session, directory: Path, as_of: datetime):
    profile = json.loads((directory / "profile.json").read_text(encoding="utf-8"))
    user_id = uuid5(NAMESPACE_URL, "nexxt-dev:" + profile["persona_id"])
    user = session.get(User, user_id)
    if user is None:
        user = User(
            id=user_id,
            name=profile["name"],
            salary_day=profile["salary_day"],
            monthly_income_minor=profile["monthly_income_minor"],
            declared_problems=profile["declared_problems"],
            context=profile["context"],
        )
        session.add(user)
        session.commit()
    job = import_csv(session, user_id, (directory / "transactions.csv").read_bytes(), as_of=as_of)
    if job.status != "completed":
        raise RuntimeError(f"Import seed eșuat: {profile['persona_id']}: {job.error_code}")
    from app.models import Merchant, Transaction

    first = session.scalar(
        select(Transaction.occurred_at)
        .where(Transaction.import_id == job.id)
        .order_by(Transaction.occurred_at)
    )
    # Fixture-only adapter: explicit connected source is written in human-readable context.
    # Production connection state is configured using PATCH /subscriptions/{id}.
    for context in profile["context"]:
        match = re.search(r"Sursa (geofence|health|manual) pentru (.+?) este conectată", context)
        if not match:
            continue
        subscription = session.scalar(
            select(Subscription)
            .join(Merchant)
            .where(Subscription.user_id == user_id, Merchant.name_normalized == match[2].upper())
        )
        if subscription:
            subscription.usage_source = match[1]
            subscription.usage_connected_at = first or subscription.usage_connected_at
    for record in json.loads((directory / "usage_signals.json").read_text(encoding="utf-8")):
        subscription = session.scalar(
            select(Subscription)
            .join(Merchant)
            .where(
                Subscription.user_id == user_id,
                Merchant.name_normalized == record["subscription_merchant"].upper(),
            )
        )
        if subscription is None:
            continue
        occurred_at = datetime.fromisoformat(record["occurred_at"]).astimezone(UTC)
        if not session.scalar(
            select(UsageSignal.id).where(
                UsageSignal.subscription_id == subscription.id,
                UsageSignal.source == record["source"],
                UsageSignal.occurred_at == occurred_at,
            )
        ):
            session.add(
                UsageSignal(
                    user_id=user_id,
                    subscription_id=subscription.id,
                    source=record["source"],
                    occurred_at=occurred_at,
                )
            )
    session.flush()
    patterns = AnalyticsPipeline(session).run_full(user_id, as_of)
    session.commit()
    return user_id, patterns


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument(
        "--as-of", default="2026-10-31T23:59:59+02:00", help="Explicit fixture horizon, not the machine clock"
    )
    args = parser.parse_args()
    as_of = datetime.fromisoformat(args.as_of).astimezone(UTC)
    with SessionLocal() as session:
        for directory in sorted(args.root.iterdir()):
            if (directory / "profile.json").exists():
                user_id, patterns = load_persona(session, directory, as_of)
                print(f"{directory.name}: X-User-Id={user_id}; patterns={len(patterns)}")
