# Docker Setup & Run Guide

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/install/) v2+
- Node.js 18+ (local, for generating migrations before building)

---

## Quick Start

### 1. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

```env
DATABASE_URL=postgresql://vms:vms_password@postgres:5432/vms_database
JWT_SECRET=change-this-to-a-strong-random-secret

POSTGRES_USER=vms
POSTGRES_PASSWORD=vms_password
POSTGRES_DB=vms_database
```

> `DATABASE_URL` must use `postgres` as the hostname — that's the service name Docker Compose assigns to the database container.

---

### 2. Generate database migrations (run locally, before building)

Migration SQL files must exist before building the image — they get bundled into `dist/db/migrations/` at build time.

```bash
npm install
npm run db:generate
```

> Only needed once, or whenever you change the database schema (`src/db/schema/tables.ts`). Commit the generated files.

---

### 3. Build and start

```bash
docker compose up --build
```

This starts:
- `postgres` — PostgreSQL 16 on port `5432`
- `app` — VMS API on port `3000`

The app waits for Postgres to pass its health check before starting.

---

### 4. Run migrations inside the container

```bash
docker compose exec app node dist/db/migrate.js
```

---

### 5. (Optional) Seed with test data

```bash
docker compose exec app node dist/db/seed.js
```

---

### 6. Verify

```bash
curl http://localhost:3000/health
```

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

| Task | Command |
|---|---|
| Start (background) | `docker compose up -d` |
| Stop | `docker compose down` |
| Stop + wipe database | `docker compose down -v` |
| Rebuild after code changes | `docker compose up --build` |
| View all logs | `docker compose logs -f` |
| View app logs only | `docker compose logs -f app` |
| Shell into app container | `docker compose exec app sh` |
| Connect to database | `docker compose exec postgres psql -U vms -d vms_database` |
| Run migrations | `docker compose exec app node dist/db/migrate.js` |
| Run seed | `docker compose exec app node dist/db/seed.js` |

---

## Local Development (without Docker)

```bash
npm install
cp .env.example .env   # set DATABASE_URL to a local or Neon postgres
npm run db:generate    # generate migrations (if schema changed)
npm run db:migrate     # apply migrations
npm run dev            # start with hot reload
```

---

## Using Neon Instead of Local Postgres

Update `.env` to point to your Neon database and skip the `postgres` service:

```env
DATABASE_URL=postgresql://user:pass@ep-example.us-east-1.aws.neon.tech/vms_database?sslmode=require
```

Then start only the app container:

```bash
docker compose up --build app
```

---

## Production Build

### Build image

```bash
docker build --target production -t vms-backend:latest .
```

### Run container

```bash
docker run -d \
  --name vms-backend \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your-strong-secret" \
  -e NODE_ENV="production" \
  vms-backend:latest
```

### Run migrations against production database

```bash
docker run --rm \
  -e DATABASE_URL="postgresql://..." \
  vms-backend:latest \
  node dist/db/migrate.js
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | No | `24h` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token lifetime |
| `PORT` | No | `3000` | Port the server listens on |
| `NODE_ENV` | No | `development` | `production` enables JSON logs |
| `CORS_ORIGIN` | No | `http://localhost:3000` | Comma-separated allowed origins |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window in ms (default: 15 min) |
| `RATE_LIMIT_MAX_ATTEMPTS` | No | `100` | Max requests per window per IP |
| `LOG_LEVEL` | No | `info` | `error` \| `warn` \| `info` \| `debug` |
| `POSTGRES_USER` | No | `vms` | docker-compose postgres user |
| `POSTGRES_PASSWORD` | No | `vms_password` | docker-compose postgres password |
| `POSTGRES_DB` | No | `vms_database` | docker-compose postgres database |

---

## Troubleshooting

**"Missing required environment variables" on startup**
→ `.env` file is missing or `DATABASE_URL` / `JWT_SECRET` are not set.

**`ECONNREFUSED` connecting to postgres**
→ The app started before postgres was ready. Restart with `docker compose up`.

**Migrations fail with "no such file or directory"**
→ You haven't run `npm run db:generate` locally before building. Generate migrations, then rebuild: `docker compose up --build`.

**Port 5432 already in use**
→ A local postgres is running. Change the host port in `docker-compose.yml`:
```yaml
ports:
  - "5433:5432"
```
Then update `DATABASE_URL` to use port `5433`.

**Schema changes not reflected after rebuild**
→ Run `npm run db:generate` locally, commit the new migration file, then `docker compose up --build` and re-run `docker compose exec app node dist/db/migrate.js`.
