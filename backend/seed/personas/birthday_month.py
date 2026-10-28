from .base import Persona

PERSONA = Persona(
    "birthday_month", "Ioana Exemplu", 5, 800_000, 230_000, 450_000,
    ("Luna viitoare am multe aniversări și vreau să mă pregătesc.",),
    ("Calendarul personal este conectat.", "Cadourile, florile și mesele aniversare sunt plătite din acest cont.", "Nume fictiv."),
    (
        ("Am zece zile de naștere luna viitoare. Cât să pun deoparte?", ("get_upcoming_expenses", "get_spending_summary"), "upcoming_spike"),
        ("Cât am dat pe cadouri în lunile cu multe aniversări?", ("get_spending_summary", "get_upcoming_expenses"), "birthday_history"),
        ("Pot să mă pregătesc de acum fără să intru în economii?", ("get_cashflow_pattern", "get_upcoming_expenses"), "birthday_budget"),
    ), birthdays=True,
)
