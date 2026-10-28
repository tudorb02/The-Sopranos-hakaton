FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app
ENV PYTHONPATH=/app/backend UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1
COPY pyproject.toml ./
COPY backend/app ./backend/app
COPY backend/seed/__init__.py ./backend/seed/__init__.py
RUN uv sync --extra test
COPY . .
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
