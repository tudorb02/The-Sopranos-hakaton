"""Create the two development users the Node demo uses to parse uploaded CSV statements.

Idempotent. The ids are uuid5(NAMESPACE_URL, "nexxt-demo:<persona>"), the same ones the
Node service derives (server/src/coach.js). They own only files uploaded in the demo.
"""

from uuid import NAMESPACE_URL, uuid5

from app.db import SessionLocal
from app.models import User

DEMO_USERS = {"pf": "Daria Ionescu (demo)", "student": "Matei Popescu (demo)"}


def demo_user_id(persona: str):
    return uuid5(NAMESPACE_URL, f"nexxt-demo:{persona}")


def main() -> None:
    with SessionLocal() as session:
        for persona, name in DEMO_USERS.items():
            user_id = demo_user_id(persona)
            if session.get(User, user_id) is None:
                session.add(User(id=user_id, name=name))
            print(f"{persona}: X-User-Id={user_id}")
        session.commit()


if __name__ == "__main__":
    main()
