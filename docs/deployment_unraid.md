# Unraid Deployment Guide

This guide covers deploying Starship HUD on Unraid.

## Prerequisites

- Unraid 6.9+ with Docker support
- Community Applications plugin (optional, for easier management)

## Quick Start

### Option 1: Docker Compose (Recommended)

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
   docker-compose up -d
   ```

6. Access the HUD at `http://your-unraid-ip:8000`

### Option 2: Docker Run

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

The SQLite database is stored in `/app/data` inside the container. Mount this to a persistent location:

```
/mnt/user/appdata/starship-hud/data:/app/data
```

## Accessing the HUD

- **Player View**: `http://your-unraid-ip:8000`
- **Admin Panel**: `http://your-unraid-ip:8000/admin`
- **API Docs**: `http://your-unraid-ip:8000/docs`

## Updating

### Docker Compose

```bash
cd /mnt/user/appdata/starship-hud
docker-compose pull
docker-compose up -d
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
cp /mnt/user/appdata/starship-hud/data/starship.db /mnt/user/backups/starship-hud-$(date +%Y%m%d).db
```

## Troubleshooting

### Container won't start

Check logs:
```bash
docker logs starship-hud
```

### Database issues

Reset the database:
```bash
docker exec starship-hud rm /app/data/starship.db
docker restart starship-hud
```

### Network issues

Ensure port 8000 is not in use:
```bash
netstat -tulpn | grep 8000
```

## Reverse Proxy (Optional)

If using Nginx Proxy Manager or similar:

1. Point your domain to the Unraid IP
2. Configure proxy host:
   - Domain: `hud.yourdomain.com`
   - Forward Hostname: `starship-hud` (or Unraid IP)
   - Forward Port: `8000`
   - Enable Websockets (for future real-time updates)

## Smoke Test Checklist

After deployment, verify:

- [ ] Homepage loads (`/`)
- [ ] Panel index shows stations
- [ ] At least one panel displays widgets
- [ ] Admin dashboard accessible (`/admin`)
- [ ] System states update when modified in admin
- [ ] Scenarios execute successfully
- [ ] Data persists after container restart
