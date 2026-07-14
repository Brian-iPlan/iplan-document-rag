# Use a slim, official Python image for the builder stage
FROM python:3.11-slim AS builder

# Set working directory and environment for faster, deterministic builds
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Install runtime dependencies first (leverages Docker layer cache)
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy the application source code
COPY . .

# -------------------------------------------------
# Runtime image (smaller, production‑ready)
# -------------------------------------------------
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set default port (Cloud Run provides $PORT at runtime)


# Copy only the built artifacts (installed packages and app code) from the builder stage
COPY --from=builder /app /app

# Create a non‑root user for security
RUN addgroup --system app && adduser --system --group app
USER app

# Expose the port Cloud Run expects (optional, but good practice)
EXPOSE 8080

# Add a simple healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD curl -f http://localhost:${PORT}/health || exit 1

# Start the app with Gunicorn, binding to the $PORT provided by Cloud Run
CMD exec gunicorn --bind :$PORT --workers 1 --timeout 300 app:app