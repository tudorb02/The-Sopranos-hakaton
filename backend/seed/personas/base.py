"""Declarative persona configuration; all monetary values are integer bani."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Persona:
    persona_id: str
    name: str
    salary_day: int
    monthly_income_minor: int
    rent_minor: int
    opening_balance_minor: int
    declared_problems: tuple[str, ...]
    context: tuple[str, ...]
    chats: tuple[tuple[str, tuple[str, ...], str], ...]
    coffee: bool = False
    gym: bool = False
    inactive_gym: bool = False
    birthdays: bool = False
    shortage: bool = False
    savings_goal: bool = False
