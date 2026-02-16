# OneHash ATS Monorepo

OneHash ATS is a full-stack Applicant Tracking System built as a monorepo.

It includes:
- `apps/web`: Next.js 15 App Router frontend
- `apps/backend`: FastAPI backend with async SQLAlchemy and Alembic
- `packages/ui`: shared UI package used by the frontend
- `docker-compose.yml`: local orchestration for Postgres, backend, and web

## A. Overview

This repository is structured to support local development and containerized development with a clear separation between frontend and backend apps.

Core stack:
- Frontend: Next.js 15, TypeScript, Tailwind
- Backend: FastAPI, SQLAlchemy 2.0 async, Alembic, psycopg3
- Database: PostgreSQL 15

## Quick Start (Docker)

```bash
docker-compose up --build
```

Open:
- `http://localhost:3000`
- `http://localhost:8000/health`
- `http://localhost:3000/debug-api`

## Architecture Summary

Browser -> Next.js -> FastAPI -> PostgreSQL  
Cloudflare -> ALB -> ECS -> RDS (production)

## B. Folder Structure

```text
ATS/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   ├── next.config.js
│   │   └── Dockerfile
│   └── backend/
│       ├── app/
│       ├── alembic/
│       ├── alembic.ini
│       ├── requirements.txt
│       └── Dockerfile
├── packages/
│   └── ui/
├── infra/
├── docker-compose.yml
└── README.md
```

## C. Requirements

Recommended local toolchain:
- Node.js: 20.x LTS
- npm: 10+
- Python: 3.11+
- Docker Engine: 24+
- Docker Compose plugin: v2+

Database:
- PostgreSQL 15 (Docker is recommended)

## D. Environment Variables

### Backend (`apps/backend`)

Local backend env file:
- `apps/backend/.env` (local only, gitignored)

Template file (tracked):
- `apps/backend/.env.example`

Current template:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/ats_db
IS_PRODUCTION=false
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Variables:
- `DATABASE_URL`: full SQLAlchemy DSN for backend and Alembic
- `IS_PRODUCTION`: runtime mode switch (`true`/`false`)
- `CORS_ORIGINS`: comma-separated origins allowed by backend CORS middleware

### Frontend (`apps/web`)

Local frontend env file:
- `apps/web/.env.local` (local only, gitignored)

Example value:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Usage:
- Frontend API client reads `process.env.NEXT_PUBLIC_API_URL`
- Fallback base URL is `http://localhost:8000`
- `apps/web/.env.local` is for host-based local development
- `docker-compose` injects container environment variables directly

## E. Local Development (Without Docker)

### 1) Backend

```bash
cd apps/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Copy env template if needed:

```bash
cp .env.example .env
```

Run migrations and backend:

```bash
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Quick tests:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/me
```

Expected `/health` response:

```json
{"status":"ok"}
```

### 2) Frontend

```bash
cd apps/web
npm install
npm run dev
```

Open:
- `http://localhost:3000`
- `http://localhost:3000/debug-api`

## F. Local Development (With Docker)

Start all services:

```bash
docker-compose up --build
```

Service ports:
- Postgres: `5432`
- Backend: `8000`
- Web: `3000`

Stop services:

```bash
docker-compose down
```

Rebuild from scratch:

```bash
docker-compose build --no-cache
docker-compose up
```

## G. Database & Migrations

Migration files are in:
- `apps/backend/alembic/versions/`

Useful commands:

```bash
cd apps/backend
source venv/bin/activate
alembic current
alembic history
alembic upgrade head
alembic downgrade -1
```

Create a new migration after model changes:

```bash
alembic revision --autogenerate -m "describe_change"
```

Recommended workflow:
1. Update models
2. Generate migration
3. Review migration file
4. Apply with `alembic upgrade head`
5. Run backend and smoke test endpoints

## H. Useful Commands

Frontend:

```bash
cd apps/web
npm install
npm run dev
npm run build
npm run lint
npx tsc --noEmit
```

Backend:

```bash
cd apps/backend
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

If additional backend format/lint tools are introduced (for example `ruff`, `black`, `mypy`), run them from `apps/backend`.

## I. Troubleshooting

### `alembic: command not found`
Use the backend virtual environment:

```bash
cd apps/backend
source venv/bin/activate
alembic current
```

### `pip: command not found`
Use `python3 -m pip`:

```bash
python3 -m pip install -r requirements.txt
```

### `email-validator` missing
Install backend dependencies in the active venv:

```bash
cd apps/backend
source venv/bin/activate
pip install -r requirements.txt
```

### Database connection refused
- Ensure Postgres is running (local or Docker)
- Verify `DATABASE_URL` in `apps/backend/.env`
- With Docker, ensure backend uses host `postgres` in compose network

### CORS errors in browser
- Verify backend `CORS_ORIGINS` contains frontend origin
- Default local origins:
  - `http://localhost:3000`
  - `http://127.0.0.1:3000`

### `NEXT_PUBLIC_API_URL` not set
Set in `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Restart the Next.js dev server after env changes.

## J. Production Notes (ECS)

- Backend container definition uses `apps/backend/Dockerfile`
- Web container definition uses `apps/web/Dockerfile`
- Do not run `uvicorn --reload` in production
- Production DB should be Amazon RDS PostgreSQL
- Typical edge architecture: Cloudflare -> ALB -> ECS services
- Pass all runtime config via environment variables/secrets manager, not code defaults
