# Starship HUD Backend

FastAPI-based backend for the Starship HUD project.

## Setup

```bash
# From project root
just setup

# Or manually in backend directory
uv sync
```

## Development

```bash
# Run development server
just dev-backend

# Or manually
uvicorn app.main:app --reload --port 8000
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Database

SQLite database located at `data/starship.db` (created automatically on first run)

## Testing

```bash
just test-backend
```
