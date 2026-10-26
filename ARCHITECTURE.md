# Architecture

## Services

- **Next.js frontend** (`frontend/`): authenticated pages for cases, documents, knowledge base, search, requirements, review, and proposal drafting.
- **FastAPI backend** (`backend/app/`): REST APIs, authentication, authorization, data validation, and exports. OpenAPI is generated at `/openapi.json`; Swagger UI is `/docs`.
- **PostgreSQL + pgvector**: tenant-scoped relational records and vectors.
- **Redis + Celery**: asynchronous extraction, chunking, and embedding jobs.
- **Storage**: uploaded files are written under `DOCUMENT_STORAGE_PATH/<tenant UUID>/...`; database paths are relative to the storage root.

## Tenant isolation

Every tenant-owned row includes `tenant_id`. Request handlers obtain the tenant from the authenticated `User` record rather than accepting a tenant identifier from the client. Case, document, historical-document, requirement, proposal-section, proposal-issue, and search queries apply that tenant scope. Similarity search filters both chunk and document by tenant before ordering by vector distance. Do not add a new query that uses a client-supplied tenant ID as its authorization source.

Storage is separated by tenant UUID. Uploaded archive members are path-validated and limited by size. Production deployment should additionally use private object storage, malware scanning, retention policies, and per-tenant quotas.

## Authentication and RBAC

JWT access and refresh tokens are used by the frontend API helper. Roles:

- `admin`: administrative operations, user management, historical record deletion, and reviewer capabilities.
- `editor`: create/manage tender work, upload documents, run extraction, edit proposal drafts and issues.
- `reviewer`: inspect/correct extraction and approve completed proposals.

`require_admin`, `require_editor`, and `require_reviewer` dependencies guard write endpoints. Read endpoints require an authenticated user and still scope records to their tenant.

## Processing pipeline

1. Upload validation checks the extension and upload size.
2. Files are stored beneath the tenant storage directory and metadata is committed.
3. Celery workers unpack ZIP files, extract text from PDF/DOCX/XLSX, chunk text, request embeddings through `EmbeddingProviderInterface`, and persist chunks/citations.
4. Status and a human-readable `processing_error` are persisted for the UI to poll.
5. Historical search embeds the query and runs tenant-filtered pgvector cosine-distance search, returning document name and page/paragraph/row metadata.
6. Requirement extraction sends processed case chunks through `LLMProviderInterface`, then persists results with confidence and citations. Review corrections are persisted separately from original text.

## AI provider abstraction

`LLMProviderInterface`, `EmbeddingProviderInterface`, and `VectorRetrieverInterface` define provider-independent contracts. `AIService` is the application facade; `factory.py` chooses an adapter. The default mock adapters are deterministic fixtures for local development. A production provider should be implemented as an adapter, configured only through environment variables, and must preserve the schema contracts and embedding dimensions. Changing embedding dimensions requires a coordinated migration/re-index of both chunk tables and their vector indexes.

## Main data model

- `tenants`, `users`, `refresh_tokens`, `password_reset_tokens`
- `tender_cases`, `documents`, `document_chunks`
- `historical_documents`, `historical_document_chunks`
- `extracted_requirements`: category, mandatory flag, confidence percentage, deadline/lot/evidence/evaluation metadata, source citation, review status, correction and reviewer note
- `proposal_sections`: editable proposal content and completion status
- `proposal_issues`: severity and resolved state

All new tables use UUID identifiers and tenant IDs. Foreign keys cascade when the parent tenant/case is removed where appropriate.

## Exports and approval

DOCX export assembles proposal sections in configured order. XLSX export creates a compliance matrix from persisted extracted requirements and includes confidence, status, and citation columns. Approval is blocked unless all proposal sections have content and are marked complete and every issue is resolved.
