# 1. Builder Stage
FROM python:3.11-slim AS builder

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
  PYTHONUNBUFFERED=1 \
  PIP_NO_CACHE_DIR=1

# Install dependencies into a specific local directory
RUN pip install --upgrade pip
COPY requirements.txt .
RUN pip install --user -r requirements.txt

# 2. Runtime Stage
FROM python:3.11-slim

WORKDIR /app

# Install curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
  rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local
# Copy your application code
COPY . .

# Ensure the local bin is in PATH so Gunicorn can be found
ENV PATH=/root/.local/bin:$PATH

# Create a non-root user
RUN addgroup --system app && adduser --system --group app
RUN chown -R app:app /app
USER app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the app
CMD exec gunicorn --bind :$PORT --workers 1 --timeout 30 --chdir /app app:app