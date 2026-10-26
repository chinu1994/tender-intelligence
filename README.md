# Tender Intelligence Platform

Multi-tenant B2B SaaS for tender (RFP/bid) work: ingest tender packages, extract structured requirements with source citations, review and correct them, reuse knowledge from past bids, draft the proposal, and export DOCX/XLSX deliverables - with strict tenant isolation and no lock-in to any AI vendor.

## Features (14-step pilot workflow)

| # | Capability | Where |
|---|---|---|
| 1 | JWT authentication with organisation (tenant) scoping, refresh rotation, password reset | `/auth/*` |
| 2 | Tender case management with generated references | Cases |
| 3 | Lifecycle `New → Analysis → Review Required → Proposal Draft → Approved → Completed` with validated transitions | Case detail |
| 4 | Multi-file upload: PDF, DOCX, XLSX, ZIP | Documents |
| 5 | Server-side, asynchronous ZIP unpacking into child documents of the case | Worker |
| 6 | Live processing status (Pending/Processing/Completed/Failed) with human-readable errors, retry, delete | Documents |
| 7 | Historical knowledge base: past tenders and bids with type and win/loss/completed outcome | Knowledge Base |
| 8 | Tenant-isolated semantic search; every hit shows document, page and paragraph/row | Knowledge Base → Search |
| 9 | Typed extraction schema: deadlines, lots/bundles, mandatory requirements, evaluation criteria (with weights), required evidence, document references | Case detail / API |
| 10 | Review & correction: source excerpt side by side with editable fields, confidence/citation flags, verify/reject with attribution | Review |
| 11 | Proposal workspace: requirements, matched historical snippets, draft generation, editable sections, issue checklist, approval readiness | Proposal |
| 12 | DOCX proposal export from a standard template | Proposal |
| 13 | XLSX export: compliance matrix, lots, tender positions, deadlines, evidence, open issues | Proposal |
| 14 | Pilot acceptance case automated end to end | `backend/tests/test_pilot_acceptance.py` |

## Architecture at a glance

- **Frontend:** Next.js 16 / React 19 / TypeScript / Tailwind CSS (`frontend/`)
- **Backend:** FastAPI, SQLAlchemy 2, Alembic, Pydantic DTOs (`backend/`)
- **Data:** PostgreSQL 16 + pgvector (HNSW, cosine), row-level security per tenant
- **Async:** Celery + Redis for unpacking, parsing, chunking, embedding and extraction
- **AI:** `LLMProviderInterface`, `EmbeddingProviderInterface`, `VectorRetrieverInterface`; adapters: deterministic mocks (default), Groq, any OpenAI-compatible endpoint, pgvector
- **Roles:** Administrator, Editor, Reviewer/Approver

Details: [ARCHITECTURE.md](ARCHITECTURE.md).

## Quick start

```bash
cp .env.example .env            # set JWT_SECRET (≥32 chars) and POSTGRES_PASSWORD
docker compose up --build -d    # postgres, redis, migrations, api, worker, frontend
```

- App: http://localhost:3000 → **Register** (you become the organisation admin)
- API docs: http://localhost:8000/docs
- Try the synthetic pilot tender in [`samples/`](samples/) - see [INSTALL.md](INSTALL.md#4-try-the-pilot-package).

## Tests

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
```

276 tests against a real PostgreSQL + pgvector database: authentication, the full RBAC matrix, tenant isolation (API, storage, vector search, row-level security), ingestion and error handling, extraction and review, proposal and approval gate, DOCX/XLSX content, AI adapters, and the pilot acceptance case.

## Documentation

| Document | Contents |
|---|---|
| [INSTALL.md](INSTALL.md) | Prerequisites, environment, running locally, tests |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Data model, tenant isolation, RBAC, pipeline, AI abstraction |
| [API.md](API.md) | Endpoints, roles, data contracts (+ [`docs/openapi.json`](docs/openapi.json)) |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Compose topology, staging/production, scaling, go-live checklist |
| [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) | What is done, how it was verified, known limitations |

## Repository layout

```
backend/
  app/
    api/          routers (auth, users, cases, documents, requirements, proposal, knowledge base)
    ai/           SPI interfaces, schemas, mocks, providers, pgvector retriever
    processing/   parsers, ZIP unpacking, chunking, pipeline
    services/     extraction, lifecycle, storage, vector search, exporters
    tasks/        Celery tasks + dispatch
    db/, core/    session/RLS binding, config, security
  alembic/        migrations
  tests/          unit, integration and acceptance tests; pilot package generator
frontend/         Next.js app
samples/          synthetic pilot tender package and historical bids
docs/openapi.json OpenAPI snapshot
```

## Security notes

- All secrets come from `.env` / the environment; `.env` is git-ignored and `.env.example` contains placeholders only.
- The default mock AI adapters are for development and tests; configure a real provider before relying on extraction for bid decisions.
- OCR for scanned PDFs is not part of the MVP.
