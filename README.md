# Starship HUD

An immersive, diegetic spaceship HUD web application for tabletop campaigns.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Python](https://www.python.org/) 3.12+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [Docker](https://www.docker.com/) (for production deployment)

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

### Development Commands

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
```

Run `just` without arguments to see all available commands.

## Docker Deployment

For production deployment (e.g., on Unraid):

```bash
# Copy environment file and configure
cp .env.example .env
# Edit .env and set production values (especially ADMIN_TOKEN)

# Build and run
docker compose up -d

# View logs
docker compose logs -f
```

The application runs on port 8080 by default (configurable via `PORT` in `.env`).

### Docker Architecture

- **Frontend container**: nginx serving the React SPA, proxies `/api/` to backend
- **Backend container**: Python FastAPI server on port 8000 (internal)
- **Database**: SQLite stored in a Docker volume (`starship-data`)

### Database Persistence

- **Development**: Database stored at `backend/data/starship.db`
- **Production (Docker)**: Database stored in named volume `starship-hud-data`
  - On first run, the database is automatically created and seeded with demo data
  - Data persists across container rebuilds
  - Volume survives `docker compose down`

To reset the production database:
```bash
docker compose down
docker volume rm starship-hud-data
docker compose up -d
```

## Project Structure

```
.
├── backend/           # Python FastAPI backend
│   ├── app/
│   │   ├── api/       # Route handlers
│   │   ├── models/    # Database models
│   │   ├── services/  # Business logic
│   │   └── migrations/# Database migrations
│   ├── Dockerfile     # Backend container
│   └── tests/
├── frontend/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── styles/
│   │   └── utils/
│   ├── Dockerfile     # Frontend container (nginx)
│   ├── nginx.conf     # nginx configuration
│   └── public/
├── docs/              # Specification documents
└── docker-compose.yml # Container orchestration
```

## Architecture

- **Frontend**: React with TypeScript
- **Backend**: Python FastAPI
- **Database**: SQLite
- **Deployment**: Docker (frontend: nginx, backend: uvicorn)

## Key Features

- **Diegetic HUD Design**: Immersive sci-fi interface that feels like a real ship console
- **Dynamic Panels**: Customizable widget-based layout system
- **Player Data Editing**: Modal-based editing system with permission controls
- **Real-time Status**: Live ship system health, weapon status, cargo tracking
- **Contact Management**: Dossiers for tracking NPCs and other ships
- **GM Tools**: Admin panel for managing ship state and designing layouts

## Documentation

See the `/docs` directory for detailed specifications:

- [Status Model](docs/spec_status_model.md)
- [Layout Model](docs/spec_layout_model.md)
- [Widget Contract](docs/spec_widget_contract.md)
- [Roles & Modes](docs/spec_roles_modes.md)
- [Sync Model](docs/spec_sync_model.md)
- [Seed Ship](docs/spec_seed_ship.md)
- [Incidents & Tasks](docs/spec_incidents_tasks.md)
- [Mini-Games](docs/spec_minigames.md)
- [Posture & ROE](docs/spec_posture_roe.md)
- [Scenario Rehearsal](docs/spec_scenario_rehearsal.md)
- [Panel Navigation](docs/spec_panel_navigation.md)

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

## License

Private project for tabletop gaming use.
