.PHONY: up down logs install api web lint test build check
up:
	docker compose up --build -d --wait

down:
	docker compose down

logs:
	docker compose logs -f

install:
	uv sync --frozen
	npm --prefix apps/web ci

api:
	uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

web:
	npm --prefix apps/web run dev

lint:
	uv run ruff check .
	uv run ruff format --check .
	npm --prefix apps/web run lint

test:
	uv run pytest

build:
	npm --prefix apps/web run build

check: lint test build
