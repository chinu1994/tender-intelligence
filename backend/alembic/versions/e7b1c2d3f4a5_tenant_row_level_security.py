"""Database-level tenant isolation with PostgreSQL row-level security.

Creates the NOLOGIN role ``tender_app_rls`` and enables RLS on every
tenant-owned table with a policy that only exposes rows whose ``tenant_id``
equals the transaction setting ``app.current_tenant_id``. The API switches to
this role (``SET LOCAL ROLE``) for every authenticated request, so a query
that forgets its tenant filter still cannot read or write another tenant's
rows. When the setting is missing the policy matches nothing (fail closed).

The migration user keeps owner privileges (policies are not forced for the
owner) so migrations, background workers and login flows work unchanged.
If the database user may not create roles, the role creation is skipped with a
notice and the application falls back to application-level filtering
(see ``app.db.session.rls_available``).
"""
from alembic import op

revision = "e7b1c2d3f4a5"
down_revision = "d4a8e2f1c6b3"
branch_labels = None
depends_on = None

ROLE = "tender_app_rls"

TENANT_TABLES = (
    "tender_cases",
    "documents",
    "document_chunks",
    "historical_documents",
    "historical_document_chunks",
    "extracted_requirements",
    "proposal_sections",
    "proposal_issues",
)

POLICY = "tenant_isolation"
PREDICATE = "tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid"


def upgrade() -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{ROLE}') THEN
                CREATE ROLE {ROLE} NOLOGIN;
            END IF;
            EXECUTE format('GRANT {ROLE} TO %I', current_user);
            GRANT USAGE ON SCHEMA public TO {ROLE};
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {ROLE};
            ALTER DEFAULT PRIVILEGES IN SCHEMA public
                GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {ROLE};
        EXCEPTION WHEN insufficient_privilege THEN
            RAISE NOTICE 'Skipping creation of role {ROLE}: insufficient privilege. '
                         'Application-level tenant filtering remains active.';
        END
        $$;
        """
    )
    for table in TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"DROP POLICY IF EXISTS {POLICY} ON {table}")
        op.execute(
            f"CREATE POLICY {POLICY} ON {table} "
            f"USING ({PREDICATE}) WITH CHECK ({PREDICATE})"
        )


def downgrade() -> None:
    for table in TENANT_TABLES:
        op.execute(f"DROP POLICY IF EXISTS {POLICY} ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    # The role is left in place; it may own grants in other databases.
