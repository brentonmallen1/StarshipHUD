FROM python:3.12-slim

WORKDIR /app

# Accept version as build arg
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --no-dev --frozen

# Copy application code
COPY app/ ./app/

# Create data directory
RUN mkdir -p /app/data

# Build pre-seeded template database (baked into image for instant first-run)
RUN uv run python -m app.create_template_db /app/template.db

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
