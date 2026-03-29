#!/bin/bash
set -e

DB_PATH="/app/data/starship.db"
TEMPLATE_PATH="/app/template.db"
SEED="${SEED_DEMO_SHIP:-true}"

echo "=== Starship HUD (Unified Container) ==="

# Database initialization
if [ ! -f "$DB_PATH" ]; then
    echo "[init] No database found at $DB_PATH"
    if [ "$SEED" = "true" ] && [ -f "$TEMPLATE_PATH" ]; then
        echo "[init] Copying template database (SEED_DEMO_SHIP=true)..."
        cp "$TEMPLATE_PATH" "$DB_PATH"
        echo "[init] Template database installed with demo data."
    else
        echo "[init] Skipping template (SEED_DEMO_SHIP=$SEED). Blank database will be created at startup."
    fi
else
    echo "[init] Existing database found. Migrations will be applied if needed."
fi

# Start nginx in background
echo "[start] Starting nginx..."
nginx

# Start uvicorn in foreground
echo "[start] Starting backend API..."
exec uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
