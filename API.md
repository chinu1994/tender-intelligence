# API reference

The authoritative interactive OpenAPI schema is served by FastAPI at `/openapi.json`; Swagger UI is `/docs`. Unless otherwise noted, APIs require `Authorization: Bearer <access_token>`. Request and response UUIDs are strings. Errors use FastAPI's JSON `detail` format.

## Authentication, users, cases, and documents

Existing endpoints include `/auth/*`, `/users`, `/dashboard/summary`, `/tender-cases`, and `/tender-cases/{case_id}/documents`. They support login/refresh/password reset, tenant user management, case creation/lifecycle, multi-file uploads, document status, and retry processing. See the generated schema for exact authentication payloads and case/document DTOs.

## Knowledge base

### `GET /knowledge-base/documents`
List historical documents for the authenticated tenant. Response fields include `id`, `name`, `file_type`, `source_type`, `outcome`, `notes`, `status`, `processing_error`, and timestamps.

### `GET /knowledge-base/documents/{document_id}`
Fetch one historical record. Cross-tenant IDs return 404.

### `POST /knowledge-base/documents` (Admin/Editor)
Multipart form fields:

- `files`: one or more `.pdf`, `.docx`, `.xlsx`, or `.zip` files (50 MB maximum per upload)
- `source_type`: `past_tender`, `past_bid`, `successful_bid`, `unsuccessful_bid`, or `completed`
- `outcome` (optional), `notes` (optional)

ZIP archives are unpacked by the worker. Parent/child records expose status and processing errors.

### `DELETE /knowledge-base/documents/{document_id}` (Admin)
Delete a tenant-owned historical record and its chunks.

### `POST /knowledge-base/search`
Request:

```json
{"query":"technical compliance evidence","limit":10,"source_type":"successful_bid"}
```

`source_type` is optional. Response `results[]` includes `chunk_id`, `document_id`, `document_name`, `text`, `score`, `source_type`, `page_number`, and `paragraph_number`. Results are tenant-filtered. Semantic relevance depends on the configured embedding adapter; the default mock is not semantically meaningful.

## Structured extraction and review

### `POST /tender-cases/{case_id}/extract-requirements` (Admin/Editor)
Extract from completed documents for the selected case and persist the output. Returns `{created, requirements}`. Returns 400 when no completed source chunks exist. Re-running replaces pending extraction output but preserves reviewed items.

### `GET /tender-cases/{case_id}/requirements`
List persisted requirements. Optional `review_status` filter: `pending`, `verified`, `rejected`. Each result includes `requirement`, `original_requirement`, `category`, `mandatory`, `confidence` (0..1), `deadline_value`, `lot_bundle`, `evaluation_criteria`, `required_evidence`, source document/page/paragraph, review status, corrected text, note, and reviewer metadata.

### `PATCH /requirements/{requirement_id}` (Admin/Reviewer)
Partial JSON fields: `requirement`, `category`, `mandatory`, `review_status`, `corrected_requirement`, `review_note`. Setting `requirement` stores a correction without overwriting the original extraction. `review_status` is `pending`, `verified`, or `rejected`.

## Proposal workspace

### `GET /tender-cases/{case_id}/proposal`
Returns case metadata, proposal `sections[]`, and `issues[]`. Creates a default set of empty sections on first access.

### `POST /tender-cases/{case_id}/proposal/sections` (Admin/Editor)
JSON: `{"title":"Technical Approach","content":"...","status":"draft","sort_order":2}`.

### `PATCH /proposal/sections/{section_id}` (Admin/Editor)
Partial fields: `title`, `content`, `status` (`draft` or `complete`), `sort_order`.

### `POST /tender-cases/{case_id}/proposal/issues` (Admin/Editor)
JSON: `{"title":"Confirm insurance evidence","description":"...","severity":"high"}`. Severity: `low`, `medium`, `high`.

### `PATCH /proposal/issues/{issue_id}` (Admin/Editor)
Partial fields: `title`, `description`, `severity`, `resolved`.

### `POST /tender-cases/{case_id}/proposal/approve` (Admin/Reviewer)
Approval succeeds only if each section has non-empty content and status `complete`, and all issues are resolved. Updates case status to `approved`.

### `GET /tender-cases/{case_id}/proposal/export.docx`
Downloads a formatted DOCX proposal with case metadata and ordered sections.

### `GET /tender-cases/{case_id}/proposal/export.xlsx`
Downloads an XLSX compliance matrix with requirement text, category, mandatory flag, confidence, review status, source references, and reviewer notes.

## Dashboard

### `GET /dashboard/summary`
Returns user and tenant identity plus tenant-scoped counts for cases/opportunities, uploaded documents, historical documents, requirements, pending reviews, open proposal issues, and proposal sections.

## Lifecycle guidance

The main lifecycle is `new → analysis → review_required → proposal_draft → approved → completed`. Extraction marks a case `review_required`; proposal approval marks it `approved`. Completing the final lifecycle transition can be managed through the existing case update endpoint.
