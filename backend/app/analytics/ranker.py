import hashlib
import json
import unicodedata
from decimal import Decimal

from app.analytics.detectors.base import Pattern, UserProfile


def fingerprint(pattern: Pattern) -> str:
    key = [
        pattern.type,
        pattern.evidence.get("merchant_id"),
        pattern.evidence.get("window"),
        pattern.evidence.get("currency", "RON"),
    ]
    return hashlib.sha256(json.dumps(key, sort_keys=True).encode()).hexdigest()


def score(pattern: Pattern, profile: UserProfile) -> Decimal:
    novelty = {"seen": "0.5", "accepted": "0.25", "dismissed": "0.1"}.get(
        profile.previous_statuses.get(fingerprint(pattern)), "1"
    )
    text = " ".join(profile.declared_problems).lower()
    text = "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))
    keywords = {
        "daily_habit": ("repede", "unde", "cafe"),
        "weekly_habit": ("unde", "cheltui"),
        "morning_spending": ("repede", "unde", "cafe"),
        "end_of_cycle_shortage": ("salariu", "fara bani"),
        "subscription": ("sala", "abonament"),
        "unused_subscription": ("sala", "abonament"),
    }
    relevance = Decimal("1.5") if any(key in text for key in keywords.get(pattern.type, ())) else Decimal(1)
    return (
        Decimal(pattern.monthly_impact_minor)
        / 10000
        * Decimal(str(pattern.confidence))
        * Decimal(novelty)
        * relevance
    )


def rank(patterns: list[Pattern], profile: UserProfile) -> list[Pattern]:
    return sorted(patterns, key=lambda pattern: (-score(pattern, profile), fingerprint(pattern)))
