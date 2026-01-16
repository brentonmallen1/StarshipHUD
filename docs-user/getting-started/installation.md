# Installation

Starship HUD is deployed using Docker. This guide covers setup on Unraid and general Docker environments.

## Prerequisites

- Docker and Docker Compose installed
- A machine accessible to your players (local network or internet)

## Quick Start with Docker Compose

1. **Create a directory for the app:**

    ```bash
    mkdir -p starship-hud
    cd starship-hud
    ```

2. **Download the docker-compose.yml:**

    ```bash
    curl -O https://raw.githubusercontent.com/your-repo/starship-hud/main/docker-compose.yml
    ```

3. **Create an environment file:**

    ```bash
    echo "ADMIN_TOKEN=$(openssl rand -hex 16)" > .env
    ```

    !!! note "Save your admin token"
        The `ADMIN_TOKEN` is your password for the admin panel. Save it somewhere secure.

4. **Start the container:**

    ```bash
    docker compose up -d
    ```

5. **Access the HUD** at `http://your-server-ip:8000`

## Unraid Deployment

### Using Docker Compose (Recommended)

1. SSH into your Unraid server or use the terminal

2. Create a directory for the app:

    ```bash
    mkdir -p /mnt/user/appdata/starship-hud
    cd /mnt/user/appdata/starship-hud
    ```

3. Download the docker-compose.yml:

    ```bash
    curl -O https://raw.githubusercontent.com/your-repo/starship-hud/main/docker-compose.yml
    ```

4. Create environment file:

    ```bash
    echo "ADMIN_TOKEN=$(openssl rand -hex 16)" > .env
    ```

5. Start the container:

    ```bash
    docker compose up -d
    ```

6. Access the HUD at `http://your-unraid-ip:8000`

### Using Docker Run

```bash
docker run -d \
  --name starship-hud \
  --restart unless-stopped \
  -p 8000:8000 \
  -v /mnt/user/appdata/starship-hud/data:/app/data \
  -e ADMIN_TOKEN=your-secure-token \
  starship-hud:latest
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port to expose | `8000` |
| `ADMIN_TOKEN` | Admin authentication token | `dev-admin-token` |
| `DATABASE_URL` | SQLite database path | `sqlite+aiosqlite:///./data/starship.db` |

### Persistent Storage

The SQLite database is stored in `/app/data` inside the container. Mount this to a persistent location to preserve your data across container restarts:

```
/path/to/your/data:/app/data
```

## Updating

### Docker Compose

```bash
cd /path/to/starship-hud
docker compose pull
docker compose up -d
```

### Docker Run

```bash
docker stop starship-hud
docker rm starship-hud
docker pull starship-hud:latest
# Re-run the docker run command
```

## Backup

The database is a single SQLite file. To backup:

```bash
cp /path/to/data/starship.db /path/to/backups/starship-hud-$(date +%Y%m%d).db
```

## Reverse Proxy (Optional)

If using Nginx Proxy Manager or similar:

1. Point your domain to the server IP
2. Configure proxy host:
    - Domain: `hud.yourdomain.com`
    - Forward Hostname: `starship-hud` (or server IP)
    - Forward Port: `8000`
    - Enable Websockets (for future real-time updates)

## Troubleshooting

### Container won't start

Check logs:

```bash
docker logs starship-hud
```

### Database issues

Reset the database (this will delete all data):

```bash
docker exec starship-hud rm /app/data/starship.db
docker restart starship-hud
```

### Port conflicts

Ensure port 8000 is not in use:

```bash
netstat -tulpn | grep 8000
```

Change the port in your environment file or docker-compose.yml if needed.
