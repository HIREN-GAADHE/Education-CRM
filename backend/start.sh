#!/bin/bash
set -e

echo "=================================================="
echo " EduERP — Deployment Startup"
echo "=================================================="

# ── 0. Pre-migration check ────────────────────────────────────────────────────
# If the DB already has tables (from old ad-hoc scripts) but NO alembic_version
# table, stamp to the latest migration so alembic doesn't re-run everything.
echo "[0/3] Checking database migration state..."
python - <<'PYEOF'
import os, sys

raw_url = os.environ.get("DATABASE_URL", "")
if not raw_url:
    print("  ERROR: DATABASE_URL is not set")
    sys.exit(1)

# Build sync URL (strip async driver + Neon-specific params)
sync_url = (
    raw_url
    .replace("+asyncpg", "")
    .replace("&channel_binding=require", "")
    .replace("?channel_binding=require&", "?")
    .replace("?channel_binding=require", "")
)

try:
    from sqlalchemy import create_engine, text
    engine = create_engine(sync_url)
    with engine.connect() as conn:

        # Check if alembic_version table exists
        has_alembic = conn.execute(text(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='alembic_version'"
        )).scalar()

        # Check if 'courses' table exists (indicator that old scripts already ran)
        has_courses = conn.execute(text(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='courses'"
        )).scalar()

        if not has_alembic and has_courses:
            print("  Existing DB detected (no alembic tracking). Stamping to payroll migration...")
            conn.execute(text(
                "CREATE TABLE alembic_version ("
                "    version_num VARCHAR(32) NOT NULL, "
                "    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)"
                ")"
            ))
            # NOTE: must be <= 32 chars to fit alembic_version.version_num VARCHAR(32)
            conn.execute(text(
                "INSERT INTO alembic_version (version_num) VALUES ('add_payroll_tables')"
            ))
            conn.commit()
            print("  Stamped DB to: add_payroll_tables")
            print("  Alembic will now run only NEW migrations (transport tables).")
        elif has_alembic:
            print("  DB already tracked by alembic. Proceeding with upgrade head.")
        else:
            print("  Fresh DB. Alembic will create all tables from scratch.")

except Exception as e:
    print(f"  Pre-check error (non-fatal, proceeding): {e}")

PYEOF

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
