# Starship HUD - Development Commands
# Usage: just <command>

# Default command - show help
default:
    @just --list

# === Development ===

# Start all development servers (backend + frontend)
dev:
    @echo "Starting development servers..."
    @just backend &
    @just frontend

# Start backend development server
backend:
    cd backend && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Start frontend development server
frontend:
    cd frontend && npm run dev

# Restart backend development server
restart-backend:
    @echo "Restarting backend..."
    @pkill -f "uvicorn app.main:app" || true
    @sleep 1
    @just backend

# Restart frontend development server
restart-frontend:
    @echo "Restarting frontend..."
    @pkill -f "vite" || true
    @sleep 1
    @just frontend

# Restart all development servers
restart:
    @echo "Restarting all servers..."
    @pkill -f "uvicorn app.main:app" || true
    @pkill -f "vite" || true
    @sleep 1
    @just dev

# === Setup ===

# Initial setup - install all dependencies
setup: setup-backend setup-frontend

# Setup backend dependencies
setup-backend:
    cd backend && uv sync

# Setup frontend dependencies
setup-frontend:
    cd frontend && npm install

# === Database ===

# Rebuild database with seed data (removes old database and restarts backend)
db-rebuild:
    @echo "Rebuilding database..."
    rm -f backend/data/starship.db
    @echo "Database removed. Restarting backend to recreate and seed..."
    @pkill -f "uvicorn app.main:app" || true
    @sleep 1
    @just backend

# Reset database with seed data (alias for db-rebuild)
db-reset: db-rebuild

# Open database with sqlite3 CLI
db-shell:
    sqlite3 backend/data/starship.db

# === Testing ===

# Run all tests
test: test-backend test-frontend

# Run backend tests
test-backend:
    cd backend && uv run pytest

# Run frontend tests
test-frontend:
    cd frontend && npm test

# === Linting ===

# Run all linters
lint: lint-backend lint-frontend

# Lint backend code
lint-backend:
    cd backend && uv run ruff check .

# Lint frontend code
lint-frontend:
    cd frontend && npm run lint

# Fix linting issues
lint-fix:
    cd backend && uv run ruff check --fix .

# === Building ===

# Build for production
build: build-frontend build-docker

# Build frontend for production
build-frontend:
    cd frontend && VITE_APP_VERSION=$(cat ../VERSION) npm run build

# Build Docker images
build-docker:
    APP_VERSION=$(cat VERSION) docker compose build

# === Docker ===

# Start with Docker Compose
up:
    docker compose up -d

# Stop Docker Compose
down:
    docker compose down

# View Docker logs
logs:
    docker compose logs -f

# Rebuild and restart
rebuild:
    docker compose down
    docker compose build
    docker compose up -d

# === Utilities ===

# Clean build artifacts
clean:
    rm -rf backend/__pycache__ backend/.pytest_cache
    rm -rf frontend/node_modules frontend/dist
    rm -rf .direnv

# Generate API docs (opens in browser)
api-docs:
    @echo "API docs available at http://localhost:8000/docs"
    open http://localhost:8000/docs || xdg-open http://localhost:8000/docs

# Check if services are healthy
health:
    @echo "Backend:"
    @curl -s http://localhost:8000/api/health | jq . || echo "Backend not running"
    @echo ""
    @echo "Frontend:"
    @curl -s http://localhost:3000 > /dev/null && echo "Frontend running" || echo "Frontend not running"

# === Documentation ===

# Start documentation development server
docs:
    cd backend && uv run mkdocs serve -a 0.0.0.0:8001 -f ../mkdocs.yml

# Build documentation for production
docs-build:
    cd backend && uv run mkdocs build -f ../mkdocs.yml

# Serve production documentation build locally
docs-serve:
    cd backend && uv run mkdocs serve -a 0.0.0.0:8001 -f ../mkdocs.yml

# Setup documentation dependencies
setup-docs:
    cd backend && uv sync --extra docs

# Start all servers (backend + frontend + docs)
dev-all:
    @echo "Starting all development servers..."
    @just backend &
    @just frontend &
    @just docs

# === Version Management ===

# Show current version
version:
    @cat VERSION

# Bump version (increments MICRO, updates YYYY.MM if month changed)
version-bump:
    #!/usr/bin/env bash
    set -euo pipefail
    current=$(cat VERSION)
    current_ym=$(echo "$current" | cut -d. -f1,2)
    current_micro=$(echo "$current" | cut -d. -f3)
    now_ym="$(date +%Y).$(date +%m)"
    if [ "$current_ym" = "$now_ym" ]; then
        new_version="${now_ym}.$((current_micro + 1))"
    else
        new_version="${now_ym}.0"
    fi
    echo "$new_version" > VERSION
    echo "Version bumped: $current -> $new_version"

# Set version explicitly (e.g., just version-set 2026.02.5)
version-set ver:
    @echo "{{ver}}" > VERSION
    @echo "Version set to: {{ver}}"

# === Release Management ===

# Create a full release: bump version, tag, push containers
# Requires REGISTRY_URL in .env (e.g., registry.example.com/starship-hud)
release:
    ./scripts/release.sh

# Preview what a release would do (dry run)
release-dry-run:
    ./scripts/release.sh --dry-run
