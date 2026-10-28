from .base import Persona

PERSONA = Persona(
    "unused_gym", "Radu Exemplu", 5, 680_000, 220_000, 290_000,
    ("Plătesc sala, dar nu mai ajung la antrenamente.",),
    ("Sursa geofence pentru 18GYM este conectată pe toată perioada.", "Abonament lunar fictiv negociat, 230 lei.", "Nume fictiv."),
    (
        ("Mai plătesc sala? Nu cred că am mai fost din iunie.", ("list_subscriptions",), "unused_subscription"),
        ("Ce abonamente îmi consumă banii lunar?", ("list_subscriptions", "find_recurring_expenses"), "subscriptions"),
        ("Confirm, marchează abonamentul la sală ca planificat pentru anulare.", ("update_subscription_status",), "cancel_planned"),
    ), gym=True, inactive_gym=True,
)
