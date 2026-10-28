from .base import Persona

PERSONA = Persona(
    "end_of_month", "Alex Exemplu", 10, 550_000, 180_000, 4_500,
    ("Rămân fără bani înainte să intre salariul.",),
    ("Locuiesc cu chirie în București.", "Nume fictiv; salariul intră pe 10."),
    (
        ("Cu câteva zile înainte de salariu mai am doar câțiva lei. Unde greșesc?", ("get_cashflow_pattern", "get_spending_summary"), "end_of_cycle_shortage"),
        ("Cât cheltui în prima săptămână după salariu?", ("get_cashflow_pattern",), "payday_spending"),
        ("Ce sumă ar trebui să păstrez pentru ultima săptămână?", ("get_cashflow_pattern", "get_spending_summary"), "budget_planning"),
    ), shortage=True,
)
