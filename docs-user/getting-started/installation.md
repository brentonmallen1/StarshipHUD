# Installation

Starship HUD is deployed using Docker. This guide covers setup on general Docker environments and Unraid.

## Prerequisites

- Docker and Docker Compose installed
- A machine accessible to your players (local network or internet)

> **New to Docker?** Download [Docker Desktop](https://www.docker.com/products/docker-desktop/) for Windows, Mac, or Linux. Install it, start it, and you're ready.

## Quick Start with Docker Compose

The recommended way to run Starship HUD is using Docker Compose.

1. **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd starship-hud
    ```

    Or download and extract the ZIP file.

2. **Start the application:**

    ```bash
    docker compose up -d
    ```

    The first time you run this, Docker will build the containers. This takes a few minutes. Subsequent starts are nearly instant.

3. **Access the HUD** at `http://localhost:7891`

That's it! The application comes pre-loaded with a demo ship.

## Unraid Deployment

### Using Docker Compose (Recommended)

1. SSH into your Unraid server or use the terminal

2. Clone the repository:

    ```bash
    cd /mnt/user/appdata
    git clone <repository-url> starship-hud
    cd starship-hud
    ```

3. (Optional) Create an environment file to customize settings:

    ```bash
    cp .env.example .env
    # Edit .env to change ports or set ADMIN_TOKEN
    ```

4. Start the containers:

    ```bash
    docker compose up -d
    ```

5. Access the HUD at `http://your-unraid-ip:7891`

## Configuration

### Environment Variables

Create a `.env` file (copy from `.env.example`) to customize:

| Variable | Description | Default |
|----------|-------------|---------|
| `FRONTEND_PORT` | Port to access the HUD | `7891` |
| `BACKEND_PORT` | Port for the API (internal use) | `8000` |
| `ADMIN_TOKEN` | Token for admin operations | `dev-admin-token` |
| `SHOW_ROLE_SWITCHER` | Show player/GM toggle | `true` |

### Persistent Storage

Data is stored in a Docker volume called `starship-hud-data`. This persists across container restarts and rebuilds.

To see where your data is stored:

```bash
docker volume inspect starship-hud-data
```

## Stopping and Starting

```bash
# Stop the application
docker compose down

# Start it again
docker compose up -d

# View logs if something seems wrong
docker compose logs -f

# View logs for a specific container
docker compose logs -f frontend
docker compose logs -f backend
```

## Updating

```bash
cd /path/to/starship-hud
git pull
docker compose build
docker compose up -d
```

## Backup

The database is a SQLite file stored in the Docker volume. To backup:

```bash
# Find the volume location
docker volume inspect starship-hud-data

# Copy the database file
cp /var/lib/docker/volumes/starship-hud-data/_data/starship.db ~/backups/starship-$(date +%Y%m%d).db
```

## Reverse Proxy (Optional)

If using Nginx Proxy Manager or similar:

1. Point your domain to the server IP
2. Configure proxy host:
    - Domain: `hud.yourdomain.com`
    - Forward Hostname: `localhost` (or server IP)
    - Forward Port: `7891`
    - Enable Websockets (for future real-time updates)

## Changing Ports

To run on different ports, create a `.env` file:

```bash
# .env
FRONTEND_PORT=8080
BACKEND_PORT=8001
```

Then restart:

```bash
docker compose down
docker compose up -d
```

Access the HUD at `http://localhost:8080` (or whatever port you set).

## Troubleshooting

### Containers won't start

Check logs:

```bash
docker compose logs
```

Look for error messages in both frontend and backend containers.

### "Port already in use" error

Another application is using port 7891. Either stop that application or change the port in your `.env` file.

```bash
# Check what's using the port
lsof -i :7891
```

### Database issues

Reset the database (this will delete all your data):

```bash
docker compose down -v
docker compose up -d
```

The `-v` flag removes the data volume, so a fresh database will be created on startup.

### Build errors

Try rebuilding from scratch:

```bash
docker compose build --no-cache
docker compose up -d
```
