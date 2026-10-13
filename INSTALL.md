# Installation and local development

## Prerequisites

- Docker Engine and Docker Compose v2
- Node.js/npm compatible with the version declared in `frontend/package-lock.json`
- Git

For running the backend outside Docker, use Python 3.12 and install `backend/requirements.txt` in a virtual environment.

## Environment

```bash
cp .env.example .env
```

Set a unique `JWT_SECRET`, a strong `POSTGRES_PASSWORD`, and correct ports for your machine. Never commit `.env`. `AI_PROVIDER=mock` runs deterministic fixtures and needs no third-party AI credentials.

The frontend reads `NEXT_PUBLIC_API_URL` at build/runtime; for local development use `http://localhost:8000`. Set the variable in `frontend/.env.local`.

## Start the backend services

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f backend worker
docker compose exec backend alembic upgrade head
```

Health checks:

- `GET http://localhost:8000/health`
- `GET http://localhost:8000/health/database`
- `GET http://localhost:8000/docs`

## Start the frontend

```bash
cd frontend
npm ci
printf 'NEXT_PUBLIC_API_URL=http://localhost:8000\n' > .env.local
npm run dev
```

Open `http://localhost:3000`. Sign in with an account already created through the registration flow or provisioned for the tenant. User roles are `admin`, `editor`, and `reviewer`.

## Tests and quality checks

```bash
cd backend
python -m pytest tests -q
python -m compileall -q app
```

Frontend checks:

```bash
cd frontend
npm run lint
npm run build
```

## Typical feature flow

1. Create a tender case and upload PDF/DOCX/XLSX/ZIP documents.
2. Wait for document processing to complete in Documents.
3. Run extraction from Requirements and review the source citations.
4. Correct and verify/reject fields from Review.
5. Upload historical bids in Knowledge Base and search from Knowledge Base → Search.
6. Draft proposal sections, add and resolve issues, then export DOCX/XLSX. Reviewer approval requires all sections completed and all issues resolved.
