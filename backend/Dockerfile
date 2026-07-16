# 1. Builder Stage
FROM python:3.11-slim AS builder

WORKDIR /build
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN pip install --upgrade pip

COPY requirements.txt .
# Install into /build/venv so binaries land at a predictable, user-agnostic path
RUN python -m venv /build/venv && \
    /build/venv/bin/pip install --no-cache-dir -r requirements.txt


# 2. Runtime Stage
FROM python:3.11-slim

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user BEFORE copying files so chown works correctly
RUN addgroup --system app && adduser --system --group app

WORKDIR /app

# Copy the entire venv from builder (binaries + site-packages, all in one tree)
COPY --from=builder /build/venv /app/venv

# Copy application code
COPY . .

# Fix ownership for the non-root user
RUN chown -R app:app /app

# Put the venv's bin directory first on PATH so gunicorn is always found,
# regardless of which user is active.
ENV PATH="/app/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

USER app

EXPOSE 8080

# /health is the explicit health-check route defined in app.py
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Shell form so $PORT is expanded at runtime; Cloud Run always injects PORT=8080
CMD gunicorn --bind "0.0.0.0:${PORT:-8080}" --workers 2 --threads 2 --timeout 120 --chdir /app app:app