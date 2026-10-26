#!/bin/sh
set -e
# Optionally apply database migrations before starting (used by the
# one-shot "migrate" service; keep it off for API replicas and workers).
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  alembic upgrade head
fi
exec "$@"
