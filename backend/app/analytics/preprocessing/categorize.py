import json
from pathlib import Path
from typing import Protocol

MAPPING = json.loads(Path(__file__).with_name("categories.json").read_text())
SPENDING_TYPES: dict[str, str] = MAPPING["spending_types"]


class CategoryFallback(Protocol):
    def categorize(self, merchant: str) -> str: ...


class UncategorizedFallback:
    def categorize(self, merchant: str) -> str:
        return "uncategorized"


def categorize(
    merchant: str, alias_category: str | None = None, fallback: CategoryFallback | None = None
) -> tuple[str, str]:
    category = alias_category
    if not category:
        category = next((value for key, value in MAPPING["merchant_rules"].items() if key in merchant), None)
    if not category:
        category = (fallback or UncategorizedFallback()).categorize(merchant)
    if category not in SPENDING_TYPES:
        category = "uncategorized"
    return category, SPENDING_TYPES[category]
