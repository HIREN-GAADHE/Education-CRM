FROM python:3.11-slim

WORKDIR /app

# Cache buster — bump this date to force a full Docker layer rebuild on Render
ARG CACHE_BUST=2026-03-02

# System deps — libpq for psycopg2 (used by alembic sync mode)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer-cached)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create writable directories for uploads/storage
RUN mkdir -p /app/storage /app/uploads

# Make startup script executable
RUN chmod +x start.sh

# Expose the port Render will use (overridden via PORT env var)
EXPOSE 8000

# Health check so Render knows when the container is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

CMD ["./start.sh"]
