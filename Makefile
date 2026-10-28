.DEFAULT_GOAL := setup
.PHONY: setup up run migrate test seed openapi lint local-install local-test local-run
.PHONY: node-up node-test node-seed node-openapi demo-users

node-up:
	docker compose up --build -d db api server frontend

node-test:
	docker compose exec server sh -c 'NODE_TEST_DATABASE_URL="$$NODE_DATABASE_URL" npm test'

node-seed:
	docker compose exec server npm run seed

node-openapi:
	npm --prefix server run openapi

# Python users that own the demo's uploaded CSV statements (after `make migrate`).
demo-users:
	docker compose exec api uv run python backend/scripts/create_demo_users.py

setup:
	@python3 -c 'import os, pathlib, secrets; p=pathlib.Path(".env"); fd=os.open(p, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600) if not p.exists() else None; fd is not None and os.write(fd, ("POSTGRES_PASSWORD=" + secrets.token_hex(24) + "\n").encode()); fd is not None and os.close(fd)'

up:
	docker compose up --build -d

run: up

migrate:
	docker compose exec api uv run alembic upgrade head

test:
	docker compose exec api sh -c 'TEST_DATABASE_URL="$$DATABASE_URL" uv run pytest'

seed:
	docker compose exec api uv run python backend/scripts/load_seed.py

openapi:
	docker compose exec api uv run python backend/scripts/export_openapi.py
	docker compose cp api:/app/api/openapi.yaml api/openapi.yaml

lint:
	docker compose exec api uv run ruff check backend/app backend/tests backend/scripts backend/migrations

local-install:
	uv sync --extra test

local-test:
	uv run pytest

local-run:
	PYTHONPATH=backend uv run uvicorn app.main:app --reload
