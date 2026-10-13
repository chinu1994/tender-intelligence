# Deployment guide

## Compose topology

`docker-compose.yml` defines PostgreSQL with pgvector, Redis, the FastAPI API, and a Celery worker. The backend and worker must use identical database, Redis, and storage settings. Persistent PostgreSQL data is kept in the `postgres_data` named volume. The development Compose file exposes PostgreSQL, Redis, and API ports; restrict these ports or remove public exposure in production.

## Staging/production checklist

- [ ] Use a managed PostgreSQL instance with pgvector enabled, private networking, automated backups, and tested restore procedures.
- [ ] Use a private Redis instance with authentication/TLS and network restrictions.
- [ ] Set `JWT_SECRET` to a high-entropy secret via the deployment secret manager. Rotate any credentials that have ever been committed or shared.
- [ ] Store `POSTGRES_PASSWORD` and provider credentials in a secret manager; never bake them into images.
- [ ] Set `AI_PROVIDER` to a registered production adapter only after that adapter is implemented, tested, and configured. The current mock adapter is not suitable for real semantic search or final tender extraction.
- [ ] Mount durable private storage (or implement private object storage) at the same `DOCUMENT_STORAGE_PATH` for API and worker. Back it up and enforce tenant access controls.
- [ ] Configure allowed frontend origins instead of broad CORS. Use HTTPS and secure proxy headers.
- [ ] Run `alembic upgrade head` as a release step before new application instances receive traffic.
- [ ] Build and deploy a pinned frontend/backend image; do not bind-mount source code in production.
- [ ] Configure API/worker health checks, structured logs, alerting for failed jobs, database connection limits, and queue depth.
- [ ] Add rate limits, upload quotas, antivirus scanning, OCR for scanned PDFs if needed, and retention/deletion policies.
- [ ] Verify tenant-isolation tests against a staging database before launch.

## Migration and rollback

Back up the database and storage before migration. Apply migrations with a single release job:

```bash
docker compose exec backend alembic upgrade head
```

The latest migration adds extraction-review and proposal-workspace tables. Downgrades remove these new tables and therefore delete their data; prefer forward fixes in production.

## Scaling

Scale API replicas independently of workers. Scale workers based on queue depth and document sizes; use task time limits and concurrency appropriate to memory limits. For larger deployments, move uploaded files to private object storage and store object keys rather than relying on local container filesystems.
