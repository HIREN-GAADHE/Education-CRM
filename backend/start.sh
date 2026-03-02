#!/bin/bash
set -e

echo "=================================================="
echo " EduERP — Deployment Startup"
echo "=================================================="

# ── 1. Run Alembic migrations (idempotent, safe on existing DBs) ────────────
echo "[1/3] Running schema migrations (alembic upgrade head)..."
alembic upgrade head
echo "      Migrations complete."

# ── 2. Seed super-admin if requested ──────────────────────────────────────
if [ "$RUN_SEED" = "true" ]; then
    echo "[2/3] Running initial database seed..."
    python -m scripts.seed
else
    echo "[2/3] Skipping seed (set RUN_SEED=true on first deploy to create super admin)."
fi

# ── 3. Start Uvicorn ────────────────────────────────────────────────────────
echo "[3/3] Starting Uvicorn server on 0.0.0.0:${PORT:-8000}..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers "${WORKERS:-1}" \
    --log-level "${LOG_LEVEL:-info}"
