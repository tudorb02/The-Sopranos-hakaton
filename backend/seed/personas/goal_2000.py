from .base import Persona

PERSONA = Persona(
    "goal_2000", "Daria Exemplu", 5, 700_000, 280_000, 210_000,
    ("Vreau să cumpăr o bicicletă de 2.000 lei.",),
    ("Sunt dispusă să renunț la sală pentru achiziția de 2.000 lei.", "Economisesc puțin, dar în fiecare lună.", "Păstrez minimum 2.000 lei ca rezervă pentru facturi; bicicleta se cumpără din economiile viitoare.", "Sursa health pentru 18GYM este conectată; încă merg la sală.", "Nume fictiv; abonament lunar fictiv negociat, 230 lei."),
    (
        ("Vreau o bicicletă de 2.000 lei. În ce lună mi-aș permite-o?", ("simulate_goal", "get_spending_summary"), "goal_2000"),
        ("Sunt dispusă să renunț la sală. Cu cât aș ajunge mai repede la țintă?", ("list_subscriptions", "simulate_goal"), "goal_tradeoff"),
        ("Confirm, salvează obiectivul de 2.000 lei pentru bicicletă.", ("create_goal",), "create_goal"),
        ("Confirm, reține că sunt dispusă să renunț la sală pentru bicicletă.", ("save_memory",), "goal_preference"),
    ), gym=True, savings_goal=True,
)
