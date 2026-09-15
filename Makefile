.PHONY: up down logs install api web lint test build check migrate migration-status migration-check download-data ingest ingest-local data-report verify-data verify-data-local portfolio-demo
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

migrate:
	uv run alembic upgrade head

migration-status:
	uv run alembic current

migration-check:
	uv run alembic check


download-data:
	uv run python scripts/download_data.py --years 2023 2025 --output-dir data/raw

ingest:
	test -n "$(SOURCE)"
	docker compose run --rm api .venv/bin/python -m app.ingestion.cli $(SOURCE) --source-uri https://oracleselixir.com/gamedata/downloads

ingest-local:
	test -n "$(SOURCE)"
	uv run python -m app.ingestion.cli $(SOURCE) --source-uri https://oracleselixir.com/gamedata/downloads

data-report:
	test -n "$(SOURCE)"
	uv run python scripts/data_report.py $(SOURCE) --output docs/data-report.json

verify-data:
	docker compose run --rm api .venv/bin/python scripts/verify_database.py --minimum-matches 18000 --minimum-kpis 25

verify-data-local:
	uv run python scripts/verify_database.py --minimum-matches 18000 --minimum-kpis 25

portfolio-demo:
	uv run python scripts/build_portfolio_demo.py \
		data/raw/2023_LoL_esports_match_data_from_OraclesElixir.csv \
		data/raw/2025_LoL_esports_match_data_from_OraclesElixir.csv
