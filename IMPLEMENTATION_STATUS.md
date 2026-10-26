# Implementation Status

## Specification coverage

| Spec item | Status | Implementation / evidence |
|---|---|---|
| Multi-tenancy & isolation (DB + storage + vector) | Done | Tenant-filtered queries, PostgreSQL RLS (`e7b1c2d3f4a5`), tenant storage paths; `tests/test_tenant_isolation.py` |
| RBAC Admin / Editor / Reviewer | Done | `api/dependencies.py`; matrix in `tests/test_rbac.py` |
| Decoupled AI SPI + mock adapters | Done | `app/ai/*`; `tests/test_ai*.py`, `test_groq_provider.py` |
| Async processing (Redis + Celery) | Done | `app/tasks/*`, ZIP unpacking in worker |
| 1 Authentication | Done | JWT access + rotating refresh, reset, logout, deactivation |
| 2 Case creation | Done | `/tender-cases` |
| 3 Lifecycle states | Done | `services/lifecycle.py`, approval gate |
| 4 Multi-file upload PDF/DOCX/XLSX/ZIP | Done | `/tender-cases/{id}/documents` |
| 5 Archive unpacking | Done | `processing/parsers.unpack_zip`, `parent_document_id` |
| 6 Processing status + readable errors | Done | statuses, `processing_error`, retry/delete |
| 7 Historical knowledge base with outcomes | Done | `/knowledge-base/*` |
| 8 Similarity search with sources | Done | `PgVectorRetriever`, hits with document/page/paragraph |
| 9 Structured extraction schemas | Done | `ai/schemas.py`, `/tender-cases/{id}/extraction` |
| 10 Review & correction UI | Done | `frontend/app/dashboard/review` |
| 11 Proposal workspace | Done | `frontend/app/dashboard/proposal`, `/proposal/*` |
| 12 DOCX export | Done | `services/exporters.build_proposal_docx` |
| 13 XLSX export (positions, lots, compliance) | Done | `services/exporters.build_compliance_xlsx` |
| 14 Pilot acceptance case | Done (automated) | `tests/test_pilot_acceptance.py`, `samples/` |
| Docs README/ARCHITECTURE/INSTALL/DEPLOYMENT/API | Done | repository root |
| Secrets via .env, `.env.example` | Done | |
| Containerised dev/test | Done | `docker-compose.yml`, `.override.yml`, `.test.yml` |

## Verification performed

- Backend: **276 tests passed** against PostgreSQL 16.15 + pgvector 0.8.0 and Redis 7 (Celery eager mode), Python 3.13. Alembic upgrade → downgrade → upgrade verified for the new migrations.
- Without a database the suite reports 88 passed / 188 skipped (no failures).
- An independent code review found no cross-tenant leak; its six findings (re-extraction deleting manual edits, approval during processing, duplicate task execution, export sanitising/formula injection, HNSW filtered-search starvation, RLS failing open) were fixed with regression tests in `tests/test_review_findings.py`.
- The real asynchronous path (uvicorn + Celery worker + Redis) was exercised end to end with the pilot package.
- Frontend: full `tsc --noEmit` under `strict` against React 19 type definitions passed. `next build` and `eslint` could not be run in the build environment because the npm registry was not reachable; run `npm ci && npm run lint && npm run build` once in CI.
- Compose files validated syntactically; images were not built in the build environment (no Docker daemon). Run the containerised test command in [INSTALL.md](INSTALL.md) as the first CI step.

## Known limitations / next steps

- The default mock LLM is a transparent heuristic classifier and the mock embeddings are hashed bag-of-words. They make the full workflow demonstrable and testable offline; configure a real provider (see DEPLOYMENT.md) for production-quality extraction and semantic search.
- No OCR for scanned PDFs (clear error message instead).
- Password-reset emails: no mail transport yet (token returned outside production only).
- No antivirus scanning, rate limiting or object-storage backend yet (documented in the go-live checklist).
