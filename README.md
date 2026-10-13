# Tender Intelligence Platform

A multi-tenant tender/RFP workspace for document ingestion, historical bid knowledge, structured requirement extraction and review, proposal drafting, and DOCX/XLSX exports.

## Current implementation

- JWT access/refresh authentication, tenant-scoped users and role-based access (`admin`, `editor`, `reviewer`).
- Tender case lifecycle: `new → analysis → review_required → proposal_draft → approved → completed`.
- PDF, DOCX, XLSX, and ZIP upload; ZIP unpacking; asynchronous processing with Celery and Redis.
- Historical knowledge base with outcome/source metadata, chunking, embeddings, source-cited search, and tenant filtering.
- Persisted extraction results with confidence, document/page/paragraph citations, deadlines/lots/evidence/evaluation metadata, and reviewer corrections.
- Proposal sections and open-issue checklist, reviewer approval gate, proposal DOCX export, and XLSX compliance matrix export.
- Frontend routes wired to APIs for knowledge base/search, requirements, review, and proposal workspace.
- Provider-agnostic LLM/embedding/vector interfaces. `AI_PROVIDER=mock` is the default and is intended for development/tests, not production-quality semantic interpretation.

## Quick start (Docker)

1. Copy the environment template and replace the sample secrets:

   ```bash
   cp .env.example .env
   ```

   Set `JWT_SECRET` to a random secret of at least 32 bytes and use a strong database password. Do not commit `.env`.

2. Start services from the repository root:

   ```bash
   docker compose up --build -d
   ```

3. Apply migrations inside the backend container:

   ```bash
   docker compose exec backend alembic upgrade head
   ```

4. Start the Next.js frontend in `frontend/`:

   ```bash
   npm ci
   cp .env.local.example .env.local  # if the example exists; otherwise set NEXT_PUBLIC_API_URL=http://localhost:8000
   npm run dev
   ```

5. Open `http://localhost:3000`. API docs are available at `http://localhost:8000/docs`.

See [INSTALL.md](INSTALL.md), [ARCHITECTURE.md](ARCHITECTURE.md), [API.md](API.md), and [DEPLOYMENT.md](DEPLOYMENT.md) for details.

## Important operational notes

- Run Alembic migrations before using the new extraction/proposal APIs.
- The backend and worker must share the same `DOCUMENT_STORAGE_PATH` volume; Compose mounts the backend directory into both services.
- Keep storage private; API responses expose document names and source metadata, not file download URLs.
- The mock embedding provider hashes text into small deterministic vectors. This makes local pipeline tests repeatable but does **not** provide meaningful semantic similarity. Plug a real provider into the existing interfaces before a customer-facing deployment.
- OCR for scanned/image-only PDFs is not included; extraction depends on text being available in the source document.
- Run tests from `backend/`: `python -m pytest tests -q`.
