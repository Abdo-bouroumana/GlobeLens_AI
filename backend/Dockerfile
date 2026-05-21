# =============================================================================
# GlobeLens AI — FastAPI Backend Dockerfile
# Multi-stage build: base → development → production
# =============================================================================

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: base — shared Python environment and system dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS base

# Build metadata labels
LABEL maintainer="GlobeLens AI Team"
LABEL description="GlobeLens AI FastAPI Backend"
LABEL version="2.0"

# Prevent Python from writing .pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # pip config
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # Application directory
    APP_HOME=/app

WORKDIR $APP_HOME

# Install system dependencies required by psycopg2, Pillow, and lxml
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        libpq-dev \
        libssl-dev \
        libffi-dev \
        libxml2-dev \
        libxslt-dev \
        gcc \
        git \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies in a dedicated layer for caching
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy Alembic migration files
COPY alembic.ini .
COPY alembic ./alembic

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: development — hot-reload via uvicorn --reload
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS development

ENV APP_ENV=development

# Copy the full application source
COPY ./app ./app

# Expose FastAPI port
EXPOSE 8000

# Health check probe — calls the dedicated /health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start uvicorn with hot-reload for development
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--reload", \
     "--reload-dir", "/app/app", \
     "--log-level", "debug"]

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: production — hardened, minimal image
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS production

ENV APP_ENV=production

# Create a non-root user for security
RUN addgroup --system globelens && \
    adduser --system --ingroup globelens --no-create-home globelens

COPY --chown=globelens:globelens ./app ./app

USER globelens

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production: multiple workers via gunicorn with uvicorn worker class
CMD ["gunicorn", "app.main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "4", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
