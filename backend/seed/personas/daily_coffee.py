from .base import Persona

PERSONA = Persona(
    "daily_coffee", "Mara Exemplu", 5, 650_000, 210_000, 250_000,
    ("cheltui repede banii și nu știu unde se duc",),
    ("Lucrez la birou în București și iau cafea în drum spre muncă.", "Nume fictiv."),
    (
        ("De obicei cheltui foarte repede banii și nu-mi dau seama unde se duc.", ("get_spending_summary", "find_recurring_expenses"), "morning_spending"),
        ("Cât mă costă cafeaua într-o lună?", ("find_recurring_expenses", "get_spending_summary"), "daily_habit"),
        ("Confirm, vreau să salvezi limita de maximum trei cafele pe săptămână.", ("create_budget_rule",), "coffee_limit"),
        ("Dacă îmi fac cafeaua acasă două zile pe săptămână, cât economisesc?", ("find_recurring_expenses",), "coffee_savings"),
    ), coffee=True,
)
