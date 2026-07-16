# 1. Builder Stage
FROM python:3.11-slim AS builder

# IMPORTANT: venv MUST be created at the same absolute path used in the runtime
# stage. Venv scripts bake the creation-time path into shebang lines and
# pyvenv.cfg — if the path changes between stages, all entrypoints (gunicorn
# etc.) break with 'not found' (exit 127).
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN pip install --upgrade pip

COPY requirements.txt .
RUN python -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir -r requirements.txt


# 2. Runtime Stage
FROM python:3.11-slim

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user WITH a home directory so gunicorn's control socket
# doesn't hit 'Permission denied: /nonexistent'
RUN addgroup --system app && adduser --system --group --home /home/app --create-home app

WORKDIR /app

# Copy the entire venv from builder (binaries + site-packages, all in one tree)
COPY --from=builder /app/venv /app/venv

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
# --worker-tmp-dir /tmp ensures the heartbeat pipe is writable by the non-root user
CMD gunicorn --bind "0.0.0.0:${PORT:-8080}" --workers 2 --threads 2 --timeout 120 --worker-tmp-dir /tmp --chdir /app app:app