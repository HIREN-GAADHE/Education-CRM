#!/bin/bash
set -e

echo "Starting deployment checks..."

# 1. Run Database Migrations (L&D Hub)
echo "Running L&D Hub migrations..."
python -m scripts.create_learning_tables

# 2. Run SMTP Column Migration (Tenant Settings)
echo "Running SMTP migration..."
python -m scripts.add_smtp_columns



# 3. Run General Seed if requested (Legacy/Existing)
if [ "$RUN_SEED" = "true" ]; then
    echo "Running general database seed..."
    python -m scripts.seed
fi

# 4. Start Application
echo "Starting Uvicorn server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
