# Starship HUD

An immersive, diegetic spaceship HUD web application for tabletop campaigns.

## Getting Started from Scratch

### Prerequisites

- [Nix](https://nixos.org/download.html) with flakes enabled
- [direnv](https://direnv.net/) (optional but recommended)

### First-Time Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd "StarshipHUD"
   ```

2. **Enter development environment:**
   ```bash
   # If using direnv (recommended):
   direnv allow

   # Or manually enter nix shell:
   nix develop
   ```

3. **Install dependencies:**
   ```bash
   just setup
   ```
   This will install both backend (Python/uv) and frontend (npm) dependencies.

4. **Start development servers:**
   ```bash
   just dev
   ```
   This starts both the backend (port 8000) and frontend (port 3000/5173).

5. **Open in browser:**
   - Frontend: http://localhost:5173 (or http://localhost:3000)
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

### Docker Deployment

For production deployment (e.g., on Unraid):

```bash
# Copy environment file
cp .env.example .env

# Edit .env and set production values (especially ADMIN_TOKEN)

# Build and run
docker compose up -d

# View logs
docker compose logs -f
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
│   └── tests/
├── frontend/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── styles/
│   │   └── utils/
│   └── public/
├── docs/              # Specification documents
├── data/              # SQLite database (gitignored)
└── plan_prompts/      # Planning documents
```

## Architecture

- **Frontend**: React with TypeScript
- **Backend**: Python FastAPI
- **Database**: SQLite
- **Deployment**: Docker targeting Unraid

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
- Ensure you're in the nix shell: `nix develop` or `direnv allow`
- Check if port 8000 is already in use: `lsof -i :8000`
- Try rebuilding the database: `just db-reset`

### Frontend won't start
- Ensure dependencies are installed: `just setup-frontend`
- Check if port 5173/3000 is already in use
- Clear node_modules and reinstall: `rm -rf frontend/node_modules && just setup-frontend`

### Database issues
- Reset the database: `just db-reset`
- This will delete the existing database and recreate it with seed data

## License

Private project for tabletop gaming use.
