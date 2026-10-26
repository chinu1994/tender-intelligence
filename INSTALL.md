# Installation & Local Development

## Prerequisites

| Tool | Version |
|---|---|
| Docker Engine + Docker Compose v2 | recent (Compose `depends_on: condition` support) |
| Git | any |
| Node.js + npm (only to run the frontend outside Docker) | Node 22 |
| Python (only to run the backend outside Docker) | 3.12 |

No AI provider keys are needed: the default `mock` adapters run fully offline.

## 1. Configure the environment

```bash
cp .env.example .env
python3 -c "import secrets; print(secrets.token_urlsafe(48))"   # paste as JWT_SECRET
```

Edit `.env`: set `JWT_SECRET` (≥ 32 chars) and `POSTGRES_PASSWORD`. Never commit `.env` - it is git-ignored. The full list of variables is documented inline in `.env.example`.

## 2. Start the stack

```bash
docker compose up --build -d
docker compose ps
```

This starts PostgreSQL + pgvector, Redis, a one-shot `migrate` job (`alembic upgrade head`), the API, a Celery worker and the frontend. `docker-compose.override.yml` is loaded automatically in development: it bind-mounts the backend source with auto-reload and publishes PostgreSQL (`5436`) and Redis (`6379`) for local tools.

| URL | |
|---|---|
| http://localhost:3000 | Web app |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:8000/health/database | DB health |

Logs: `docker compose logs -f backend worker`.

## 3. First login

Open http://localhost:3000/register, create your organisation - you become its **admin** - then add editors/reviewers under **Users**.

## 4. Try the pilot package

`samples/` contains a synthetic reference tender and two historical bids:

1. **Knowledge Base** → upload `historical-Bid_Riverside_2024.docx` (type *Successful bid*, outcome *Won*) and `historical-Bid_Lakeside_2023.pdf` (*Unsuccessful bid*, *Lost*).
2. **Cases** → create a case, then **Documents** → upload `pilot-tender-package.zip`. The worker unpacks five documents, indexes them and runs extraction; the case moves to *Review required*.
3. **Review** → compare each item with its source, correct/verify/reject (reviewer or admin).
4. **Proposal** → generate drafts, find precedent per requirement, generate the issue checklist, resolve it, mark sections complete.
5. Approve (reviewer/admin) and export DOCX/XLSX.

Regenerate the samples with `cd backend && python -m tests.pilot_package ../samples`.

## Running tests

### In containers (recommended, matches CI)

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
docker compose -f docker-compose.test.yml down -v
```

Uses a throw-away PostgreSQL+pgvector (tmpfs). The suite creates and migrates its own database.

### Without Docker

```bash
cd backend
python3.12 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
export POSTGRES_HOST=localhost POSTGRES_PORT=5436 POSTGRES_USER=… POSTGRES_PASSWORD=… POSTGRES_DB=tender_intelligence
python -m pytest -q          # uses database "<POSTGRES_DB>_test"
```

The test database user needs permission to create a database (or point `TEST_DATABASE_URL` at an existing empty one) and, for the row-level-security tests, to create roles (the Docker `POSTGRES_USER` can). If no database is reachable, the 188 integration tests are **skipped** and the unit tests still run.

### Frontend checks

```bash
cd frontend
npm ci
npm run lint
npx tsc --noEmit
npm run build
```

## Running services individually (without Docker)

```bash
# API
cd backend && alembic upgrade head && uvicorn app.main:app --reload
# Worker (needs Redis)
cd backend && celery -A app.worker.celery_app worker --loglevel=info
# Frontend
cd frontend && cp .env.local.example .env.local && npm run dev
```

Set `DOCUMENT_STORAGE_PATH` to a writable directory shared by API and worker. For a single-process demo without Redis, set `CELERY_TASK_ALWAYS_EAGER=true` (never in production).

## Useful commands

| Task | Command |
|---|---|
| New migration | `docker compose exec backend alembic revision --autogenerate -m "message"` |
| Apply migrations | `docker compose run --rm migrate` |
| Re-embed all chunks (after changing embedding provider) | `docker compose exec backend python -m app.cli reindex --all` |
| Export OpenAPI snapshot | see [API.md](API.md) |
| Live tenant-isolation smoke check | `python backend/scripts/check_tenant_isolation_live.py --a-email … --b-email …` |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Invalid configuration: JWT_SECRET must be set…` at startup | Set a ≥32-character `JWT_SECRET` in `.env`. |
| Documents stay *Pending* | Worker not running: `docker compose logs worker`; use **Retry** once it is up. |
| `Row-level security role tender_app_rls is not available` warning | The DB user could not create roles during migration; isolation still applies at the application level. Grant `CREATEROLE` and re-run migrations to enable RLS. |
| Upload rejected with "exceeds the 50 MB upload limit" | Raise `MAX_UPLOAD_SIZE_MB`. |
| PDF failed with "No extractable text" | Scanned PDF; OCR is not part of the MVP. |
