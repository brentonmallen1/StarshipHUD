# Contributing to Starship HUD

This guide covers development setup for contributors who want to run from source or extend the application.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Python](https://www.python.org/) 3.12+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [Docker](https://www.docker.com/) (for testing production builds)
- [just](https://just.systems/) (optional, but recommended for running commands)

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd starship-hud
   ```

2. **Install dependencies:**
   ```bash
   just setup
   ```
   This installs both backend (Python/uv) and frontend (npm) dependencies.

3. **Start development servers:**
   ```bash
   just dev
   ```
   This starts both the backend (port 8000) and frontend (port 3000).

4. **Open in browser:**
   - Frontend: http://localhost:3000
   - Backend API docs: http://localhost:8000/docs

## Development Commands

Run `just` without arguments to see all available commands.

```bash
# Start all services
just dev

# Start backend only
just backend

# Start frontend only
just frontend

# Rebuild database with seed data
just db-reset

# Run tests
just test

# Build for production
just build

# Serve documentation locally
just docs
```

## Project Structure

```
.
├── backend/           # Python FastAPI backend
│   ├── app/
│   │   ├── api/       # Route handlers
│   │   ├── models/    # Pydantic schemas
│   │   ├── services/  # Business logic
│   │   └── migrations/# Database migrations
│   ├── Dockerfile     # Backend container
│   └── tests/
├── frontend/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── widgets/   # Widget implementations
│   │   │   ├── admin/     # GM authoring components
│   │   │   └── layout/    # Layout components
│   │   ├── hooks/         # React hooks
│   │   ├── pages/         # Route-level views
│   │   ├── services/      # API client
│   │   ├── styles/        # Global CSS
│   │   └── types/         # TypeScript types
│   ├── Dockerfile     # Frontend container (nginx)
│   └── nginx.conf     # nginx configuration
├── docs/              # Technical specification documents
├── docs-user/         # User-facing documentation (MkDocs)
├── screenshots/       # Application screenshots
├── justfile           # Developer command runner
└── docker-compose.yml # Container orchestration
```

## Architecture

- **Frontend**: React with TypeScript, React Query for state management
- **Backend**: Python FastAPI with async SQLite
- **Database**: SQLite (simple, inspectable, no extra infrastructure)
- **Deployment**: Docker (frontend: nginx, backend: uvicorn)

## Key Files

### Frontend
| File | Purpose |
|------|---------|
| `frontend/src/types/index.ts` | TypeScript types (single source of truth) |
| `frontend/src/components/widgets/widgetRegistry.ts` | Widget registration and metadata |
| `frontend/src/services/api.ts` | API client |
| `frontend/src/hooks/useShipData.ts` | Data fetching hooks |
| `frontend/src/hooks/useMutations.ts` | Mutation hooks |
| `frontend/src/styles/index.css` | Design tokens |

### Backend
| File | Purpose |
|------|---------|
| `backend/app/models/base.py` | Core enums and base schemas |
| `backend/app/database.py` | SQLite schema and migrations |
| `backend/app/api/system_states.py` | Status calculation reference |
| `backend/app/seed.py` | Demo data generation |
| `backend/app/main.py` | FastAPI setup and router registration |

## Adding a New Widget

1. Create `frontend/src/components/widgets/NewWidget.tsx` implementing `WidgetRendererProps`
2. Create `frontend/src/components/widgets/NewWidget.css`
3. Register in `widgetRegistry.ts` with type, name, category, dimensions, Renderer
4. Done—no other files need changes

## Adding a New Data Domain

1. Add TypeScript types to `frontend/src/types/index.ts`
2. Add API namespace to `frontend/src/services/api.ts`
3. Add data hooks to `frontend/src/hooks/useShipData.ts`
4. Add mutation hooks to `frontend/src/hooks/useMutations.ts`
5. Create Pydantic models in `backend/app/models/`
6. Create API router in `backend/app/api/`
7. Register router in `backend/app/main.py`
8. Add table to schema in `backend/app/database.py`

## Testing Docker Builds

```bash
# Build and run production containers
docker compose up -d

# View logs
docker compose logs -f

# Rebuild from scratch
docker compose build --no-cache
docker compose up -d
```

## Database

### Development
Database stored at `backend/data/starship.db`. Reset with `just db-reset`.

### Production (Docker)
Database stored in named volume `starship-hud-data`.

To reset the production database:
```bash
docker compose down
docker volume rm starship-hud-data
docker compose up -d
```

## Troubleshooting

### Backend won't start
- Check if port 8000 is already in use: `lsof -i :8000`
- Try rebuilding the database: `just db-reset`
- Ensure uv is installed: `pip install uv`

### Frontend won't start
- Ensure dependencies are installed: `just setup-frontend`
- Check if port 3000 is already in use
- Clear node_modules and reinstall: `rm -rf frontend/node_modules && just setup-frontend`

### Database issues
- Reset the database: `just db-reset`
- This will delete the existing database and recreate it with seed data

### Docker issues
- Check container logs: `docker compose logs`
- Rebuild containers: `docker compose build --no-cache`
- Reset everything: `docker compose down -v && docker compose up -d`

## Code Style

- **Frontend**: TypeScript, React functional components, CSS modules with BEM-like naming
- **Backend**: Python, FastAPI patterns, Pydantic v2 models
- See `CLAUDE.md` for detailed conventions and patterns
