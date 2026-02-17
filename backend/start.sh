#!/bin/bash
set -e

echo "Starting deployment checks..."

# 1. Run Database Migrations (L&D Hub)
echo "Running L&D Hub migrations..."
python -m scripts.create_learning_tables

# 2. Seed L&D Content (Safe/Idempotent)
echo "Seeding L&D Hub content..."
python -m scripts.seed_learning

# 3. Run General Seed if requested (Legacy/Existing)
if [ "$RUN_SEED" = "true" ]; then
    echo "Running general database seed..."
    python -m scripts.seed
fi

# 4. Start Application
echo "Starting Uvicorn server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
