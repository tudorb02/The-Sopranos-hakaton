import os
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.db import get_session, make_engine
from app.main import app
from app.models import User

ROOT = Path(__file__).resolve().parents[2]
AS_OF = datetime(2026, 10, 31, 21, 59, 59, tzinfo=UTC)


@pytest.fixture
def engine(tmp_path):
    url = os.environ.get("TEST_DATABASE_URL")
    schema = None
    admin = None
    if url:
        if not url.startswith("postgresql"):
            raise ValueError("TEST_DATABASE_URL must be a PostgreSQL URL; tests use an isolated schema")
        schema = "test_" + uuid4().hex
        admin = create_engine(url)
        with admin.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        db = create_engine(url, connect_args={"options": f"-csearch_path={schema}"})
    else:
        db = make_engine(f"sqlite:///{tmp_path / 'test.db'}")
    try:
        config = Config(str(ROOT / "alembic.ini"))
        config.set_main_option("script_location", str(ROOT / "backend" / "migrations"))
        with db.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
        yield db
    finally:
        db.dispose()
        if admin:
            with admin.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            admin.dispose()


@pytest.fixture
def session(engine):
    with Session(engine, expire_on_commit=False) as db:
        yield db


@pytest.fixture
def user(session):
    row = User(name="Utilizator fictiv")
    session.add(row)
    session.commit()
    return row


@pytest.fixture
def client(session):
    def override():
        yield session

    app.dependency_overrides[get_session] = override
    with TestClient(app) as value:
        yield value
    app.dependency_overrides.clear()


@pytest.fixture
def headers(user):
    return {"X-User-Id": str(user.id)}
