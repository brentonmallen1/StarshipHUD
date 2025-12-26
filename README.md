# Starship HUD

An immersive, diegetic spaceship HUD web application for tabletop campaigns.

## Quick Start

### Prerequisites

- [Nix](https://nixos.org/download.html) with flakes enabled
- [direnv](https://direnv.net/) (optional but recommended)

### Development

```bash
# Allow direnv (first time only)
direnv allow

# Or manually enter nix shell
nix develop

# Start development servers
just dev

# Run backend only
just backend

# Run frontend only
just frontend
```

### Docker Deployment

```bash
# Copy environment file
cp .env.example .env

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

## License

Private project for tabletop gaming use.
