# Arete API — production container. Runs the FastAPI app with uvicorn.
# Build:  docker build -t arete-api apps/api
# Run:    docker run -p 8000:8000 --env-file apps/api/.env arete-api
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first (better layer caching)
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install -e .

# App code
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

# Non-root user
RUN useradd -m appuser && mkdir -p /app/uploads && chown -R appuser /app
USER appuser

EXPOSE 8000

# For SQLite demo this is self-contained; for Postgres set DATABASE_URL.
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
