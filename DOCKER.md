# Docker Setup & Run Guide

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/install/) v2+

---

## Quick Start (Local Development)

### 1. Clone and configure environment

```bash
cp .env.example .env
```

Edit `.env` and set the following **required** values:

```env
# Point to the Docker postgres service (not Neon) for local dev
DATABASE_URL=postgresql://vms:vms_password@postgres:5432/vms_database

# Change this to a strong secret
JWT_SECRET=change-this-to-a-strong-random-secret

# Postgres service credentials (must match DATABASE_URL above)
POSTGRES_USER=vms
POSTGRES_PASSWORD=vms_password
POSTGRES_DB=vms_database
```

### 2. Build and start all services

```bash
docker compose up --build
```

This starts:
- `postgres` — PostgreSQL 16 database on port `5432`
- `app` — VMS backend API on port `3000`

The app waits for Postgres to be healthy before starting.

### 3. Run database migrations

In a separate terminal, once the containers are running:

```bash
docker compose exec app node dist/db/migrate.js
```

Or seed with test data:

```bash
docker compose exec app node dist/db/seed.js
```

### 4. Verify the API is running

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "success": true,
  "message": "VMS Backend API is running",
  "timestamp": "...",
  "version": "1.0.0"
}
```

---

## Common Commands

### Start (detached / background)

```bash
docker compose up -d
```

### View logs

```bash
# All services
docker compose logs -f

# App only
docker compose logs -f app

# Postgres only
docker compose logs -f postgres
```

### Stop services

```bash
docker compose down
```

### Stop and remove all data (wipe database volume)

```bash
docker compose down -v
```

### Rebuild after code changes

```bash
docker compose up --build
```

### Open a shell in the app container

```bash
docker compose exec app sh
```

### Connect to the database directly

```bash
docker compose exec postgres psql -U vms -d vms_database
```

---

## Using Neon Instead of Local Postgres

If you prefer to keep using Neon as your database, remove the `postgres` service dependency and update your `.env`:

```env
DATABASE_URL=postgresql://username:password@ep-example.us-east-1.aws.neon.tech/vms_database?sslmode=require

# Leave these blank — they're only used by the local postgres service
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
```

Then run the app container only:

```bash
docker compose up --build app
```

---

## Production Deployment

### Build the production image

```bash
docker build --target production -t vms-backend:latest .
```

### Run with environment variables

```bash
docker run -d \
  --name vms-backend \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your-strong-secret" \
  -e NODE_ENV="production" \
  vms-backend:latest
```

### Environment variables reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | No | `24h` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token lifetime |
| `PORT` | No | `3000` | Port the server listens on |
| `NODE_ENV` | No | `development` | `production` enables JSON logs |
| `CORS_ORIGIN` | No | `http://localhost:3000` | Comma-separated allowed origins |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX_ATTEMPTS` | No | `100` | Max requests per window per IP |
| `LOG_LEVEL` | No | `info` | `error`, `warn`, `info`, `debug` |
| `POSTGRES_USER` | No | `vms` | Local postgres user (docker-compose only) |
| `POSTGRES_PASSWORD` | No | `vms_password` | Local postgres password (docker-compose only) |
| `POSTGRES_DB` | No | `vms_database` | Local postgres database (docker-compose only) |

---

## Health Check

The app exposes a health endpoint used by Docker's health check:

```
GET /health
```

Docker will mark the container as `unhealthy` if this endpoint does not return HTTP 200 within 10 seconds. The `app` service will not start traffic until the `postgres` service passes its own health check.

---

## Troubleshooting

**App fails to start with "Missing required environment variables"**
- Ensure `.env` exists and contains `DATABASE_URL` and `JWT_SECRET`

**`ECONNREFUSED` connecting to postgres**
- The app container may have started before postgres was ready. Run `docker compose up` again — the `depends_on` health check should prevent this, but a restart fixes it

**Port 5432 already in use**
- Another PostgreSQL instance is running locally. Stop it or change the host port in `docker-compose.yml`:
  ```yaml
  ports:
    - "5433:5432"  # Use 5433 on the host instead
  ```

**Migrations fail**
- Confirm the app container is running and healthy before running migrations
- Check `docker compose logs app` for connection errors
