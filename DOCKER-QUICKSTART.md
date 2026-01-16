# Docker Quick Start Guide

Get the EDOT Flow Visualizer running in under 2 minutes.

## Prerequisites

- Docker Desktop or Docker Engine installed
- Docker Compose (included with Docker Desktop)

## Quick Start

### Option 1: Docker Compose (Easiest)

```bash
# Start the application
docker compose up -d

# View logs
docker compose logs -f

# Open in browser
open http://localhost:3000

# Stop when done
docker compose down
```

### Option 2: Docker Run

```bash
# Build the image
docker build -t edot-visualizer .

# Run the container
docker run -d -p 3000:3000 --name edot-visualizer edot-visualizer

# Open in browser
open http://localhost:3000

# Stop when done
docker stop edot-visualizer
docker rm edot-visualizer
```

## Configuration

Create a `.env.docker` file:

```bash
# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Port (change if 3000 is in use)
HOST_PORT=3000

# Demo mode
NEXT_PUBLIC_DEMO_MODE=true
```

Then run:

```bash
docker compose --env-file .env.docker up -d
```

## Common Commands

```bash
# Rebuild and restart
docker compose up -d --build

# View logs
docker compose logs -f

# Check status
docker compose ps

# Stop
docker compose down

# Remove volumes (full cleanup)
docker compose down -v
```

## Troubleshooting

**Port already in use?**
```bash
# Change port in .env.docker
HOST_PORT=8080
docker compose up -d
```

**Build failing?**
```bash
# Clean build
docker compose down
docker system prune -f
docker compose up -d --build
```

**Check if it's running:**
```bash
curl http://localhost:3000/api/health
```

## Next Steps

For production deployments, see [DEPLOYMENT.md](./DEPLOYMENT.md)
