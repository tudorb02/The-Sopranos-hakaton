from .base import Persona

PERSONA = Persona(
    "balanced", "Andrei Exemplu", 5, 750_000, 220_000, 500_000,
    (),
    ("Îmi distribui cumpărăturile pe parcursul lunii și păstrez o rezervă.", "Activez câte o lună de streaming, alternând serviciile; fără reînnoire automată.", "Nume fictiv."),
    (
        ("Cum stau cu cheltuielile în ultimele luni?", ("get_spending_summary",), "spending_overview"),
        ("Am suficientă rezervă până la următorul salariu?", ("get_cashflow_pattern",), "healthy_cashflow"),
        ("Observi vreun obicei care îmi afectează bugetul?", ("find_recurring_expenses", "get_spending_summary"), "no_problem_patterns"),
    ),
)
