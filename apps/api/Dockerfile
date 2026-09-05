FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.11.33 /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
COPY apps/api apps/api
COPY alembic.ini ./
COPY database/migrations database/migrations
RUN uv sync --frozen --no-dev
RUN useradd --create-home --uid 10001 appuser
USER appuser
EXPOSE 8000
CMD [".venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
