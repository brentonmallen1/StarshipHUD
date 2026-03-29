# Unified Starship HUD container
# Combines backend (FastAPI) and frontend (nginx) in a single container

# =============================================================================
# Stage 1: Build frontend
# =============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app

ARG VITE_APP_VERSION=dev
ENV VITE_APP_VERSION=$VITE_APP_VERSION

COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# =============================================================================
# Stage 2: Production image with backend + nginx
# =============================================================================
FROM python:3.12-slim

WORKDIR /app

ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

# Install nginx and curl (for healthcheck)
RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx curl && \
    rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

# Copy backend dependency files and install
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --no-dev --frozen

# Copy backend application code
COPY backend/app/ ./app/

# Create data directory
RUN mkdir -p /app/data

# Build pre-seeded template database
RUN uv run python -m app.create_template_db /app/template.db

# Copy frontend build from builder stage
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy nginx config (remove default and use conf.d)
RUN rm -f /etc/nginx/sites-enabled/default
COPY nginx.conf /etc/nginx/conf.d/starship-hud.conf

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose single port (nginx serves everything)
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost/api/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
