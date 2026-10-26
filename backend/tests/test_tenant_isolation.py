"""No cross-tenant data leakage: relational queries, files, vector search, RLS."""
import uuid

import pytest
import sqlalchemy as sa

from app.db.session import SessionLocal, bind_tenant, rls_available
from tests import factories as f
from tests.conftest import create_org

SECRET_TEXT = "Project BLUEHERON requires 24x7 helpdesk coverage with a 15 minute response time."


@pytest.fixture()
def tenants(client):
    a = create_org(client, "Alpha Tenders")
    b = create_org(client, "Beta Tenders")

    case = client.post("/tender-cases", headers=a.editor, json={"name": "Alpha confidential"}).json()
    docs = client.post(
        f"/tender-cases/{case['id']}/documents",
        headers=a.editor,
        files=[f.upload("alpha-rfp.pdf", f.pdf_bytes([[SECRET_TEXT, "", "Bidders must attach an ISO 9001 certificate."]]), f.PDF_MIME)],
    ).json()
    requirement = client.get(f"/tender-cases/{case['id']}/requirements", headers=a.admin).json()[0]
    workspace = client.get(f"/tender-cases/{case['id']}/proposal", headers=a.admin).json()
    issue = client.post(f"/tender-cases/{case['id']}/proposal/issues", headers=a.editor, json={"title": "Alpha issue"}).json()
    kb = client.post(
        "/knowledge-base/documents",
        headers=a.editor,
        files=[f.upload("alpha-bid.docx", f.docx_bytes([SECRET_TEXT]), f.DOCX_MIME)],
        data={"source_type": "successful_bid", "outcome": "won"},
    ).json()[0]
    return {
        "a": a, "b": b, "case": case["id"], "document": docs[0]["id"], "requirement": requirement["id"],
        "section": workspace["sections"][0]["id"], "issue": issue["id"], "kb": kb["id"],
    }


def test_lists_are_tenant_scoped(client, tenants):
    a, b = tenants["a"], tenants["b"]
    assert [c["id"] for c in client.get("/tender-cases", headers=a.admin).json()] == [tenants["case"]]
    assert client.get("/tender-cases", headers=b.admin).json() == []
    assert client.get("/knowledge-base/documents", headers=b.admin).json() == []
    assert {u["email"] for u in client.get("/users", headers=b.admin).json()} == set(b.emails.values())

    summary = client.get("/dashboard/summary", headers=b.admin).json()["stats"]
    assert summary["opportunities"] == summary["documents"] == summary["requirements"] == 0


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("GET", "/tender-cases/{case}", None),
        ("PATCH", "/tender-cases/{case}", {"name": "hijacked"}),
        ("DELETE", "/tender-cases/{case}", None),
        ("GET", "/tender-cases/{case}/transitions", None),
        ("GET", "/tender-cases/{case}/documents", None),
        ("GET", "/tender-cases/{case}/documents/{document}", None),
        ("POST", "/tender-cases/{case}/documents/{document}/reprocess", None),
        ("DELETE", "/tender-cases/{case}/documents/{document}", None),
        ("POST", "/tender-cases/{case}/extract-requirements", None),
        ("GET", "/tender-cases/{case}/requirements", None),
        ("POST", "/tender-cases/{case}/requirements", {"requirement": "Injected"}),
        ("GET", "/tender-cases/{case}/extraction", None),
        ("PATCH", "/requirements/{requirement}", {"review_status": "rejected"}),
        ("GET", "/requirements/{requirement}/matches", None),
        ("GET", "/tender-cases/{case}/proposal", None),
        ("POST", "/tender-cases/{case}/proposal/sections", {"title": "x"}),
        ("PATCH", "/proposal/sections/{section}", {"content": "hijacked"}),
        ("DELETE", "/proposal/sections/{section}", None),
        ("POST", "/proposal/sections/{section}/draft", None),
        ("POST", "/tender-cases/{case}/proposal/issues", {"title": "x"}),
        ("POST", "/tender-cases/{case}/proposal/issues/generate", None),
        ("PATCH", "/proposal/issues/{issue}", {"resolved": True}),
        ("DELETE", "/proposal/issues/{issue}", None),
        ("POST", "/tender-cases/{case}/proposal/approve", None),
        ("GET", "/tender-cases/{case}/proposal/export.docx", None),
        ("GET", "/tender-cases/{case}/proposal/export.xlsx", None),
        ("GET", "/knowledge-base/documents/{kb}", None),
        ("PATCH", "/knowledge-base/documents/{kb}", {"outcome": "lost"}),
        ("POST", "/knowledge-base/documents/{kb}/reprocess", None),
        ("DELETE", "/knowledge-base/documents/{kb}", None),
    ],
)
def test_foreign_ids_return_404(client, tenants, method, path, body):
    """Tenant B's admin (highest role) cannot touch any of tenant A's objects."""
    url = path.format(**tenants)
    response = client.request(method, url, headers=tenants["b"].admin, json=body)
    assert response.status_code == 404, (url, response.status_code, response.text)

    # ...and tenant A's data is unchanged
    case = client.get(f"/tender-cases/{tenants['case']}", headers=tenants["a"].admin)
    assert case.status_code == 200 and case.json()["name"] == "Alpha confidential"


def test_cross_tenant_upload_rejected(client, tenants):
    response = client.post(
        f"/tender-cases/{tenants['case']}/documents",
        headers=tenants["b"].editor,
        files=[f.upload("x.pdf", f.simple_rfp_pdf(), f.PDF_MIME)],
    )
    assert response.status_code == 404


def test_users_cannot_be_managed_across_tenants(client, tenants):
    a_users = client.get("/users", headers=tenants["a"].admin).json()
    target = a_users[0]["id"]
    assert client.patch(f"/users/{target}", headers=tenants["b"].admin, json={"role": "reviewer"}).status_code == 404


def test_vector_search_never_returns_other_tenants_content(client, tenants):
    a, b = tenants["a"], tenants["b"]
    # Tenant B indexes its own, unrelated precedent.
    client.post(
        "/knowledge-base/documents",
        headers=b.editor,
        files=[f.upload("beta-bid.docx", f.docx_bytes(["Beta provides catering services for public events."]), f.DOCX_MIME)],
        data={"source_type": "past_bid"},
    )
    # Exact text of tenant A's document: B must not get it back.
    results_b = client.post("/knowledge-base/search", headers=b.admin, json={"query": SECRET_TEXT, "limit": 50}).json()["results"]
    assert results_b, "tenant B should still see its own document"
    assert all("BLUEHERON" not in hit["text"] for hit in results_b)
    assert {hit["document_name"] for hit in results_b} == {"beta-bid.docx"}

    results_a = client.post("/knowledge-base/search", headers=a.admin, json={"query": SECRET_TEXT}).json()["results"]
    assert results_a[0]["document_name"] == "alpha-bid.docx"
    assert "BLUEHERON" in results_a[0]["text"]
    assert results_a[0]["score"] > 0.9


def test_storage_paths_are_partitioned_by_tenant(client, tenants):
    doc = client.get(f"/tender-cases/{tenants['case']}/documents/{tenants['document']}", headers=tenants["a"].admin).json()
    assert doc["file_path"].startswith(tenants["a"].tenant_id + "/")
    kb = client.get(f"/knowledge-base/documents/{tenants['kb']}", headers=tenants["a"].admin).json()
    assert kb["file_path"].startswith(tenants["a"].tenant_id + "/knowledge-base/")


def test_row_level_security_blocks_unfiltered_queries(client, tenants):
    """Even raw SQL without any tenant predicate only sees the bound tenant."""
    if not rls_available():
        pytest.skip("RLS role not available (database user lacks CREATEROLE)")
    tables = ["tender_cases", "documents", "document_chunks", "historical_documents",
              "historical_document_chunks", "extracted_requirements", "proposal_sections", "proposal_issues"]
    a_id, b_id = uuid.UUID(tenants["a"].tenant_id), uuid.UUID(tenants["b"].tenant_id)

    with SessionLocal() as session:
        owner_counts = {t: session.execute(sa.text(f"SELECT count(*) FROM {t}")).scalar() for t in tables}
    assert all(owner_counts[t] > 0 for t in tables), owner_counts

    with SessionLocal() as session:
        bind_tenant(session, b_id)
        for table in tables:
            assert session.execute(sa.text(f"SELECT count(*) FROM {table}")).scalar() == 0, table
        # writes into another tenant are rejected by the policy's WITH CHECK
        with pytest.raises(sa.exc.ProgrammingError):
            session.execute(
                sa.text("INSERT INTO proposal_issues (id, tenant_id, tender_case_id, title, severity, resolved) "
                        "VALUES (:i, :t, :c, 'x', 'low', false)"),
                {"i": uuid.uuid4(), "t": a_id, "c": uuid.UUID(tenants["case"])},
            )
        session.rollback()

    with SessionLocal() as session:
        bind_tenant(session, a_id)
        for table in tables:
            assert session.execute(sa.text(f"SELECT count(*) FROM {table}")).scalar() == owner_counts[table], table
        session.commit()
        # tenant context survives commits (re-applied on each transaction)
        assert session.execute(sa.text("SELECT count(*) FROM tender_cases")).scalar() == owner_counts["tender_cases"]


def test_rls_context_does_not_leak_between_pooled_connections(client, tenants):
    if not rls_available():
        pytest.skip("RLS role not available (database user lacks CREATEROLE)")
    with SessionLocal() as session:
        bind_tenant(session, uuid.UUID(tenants["b"].tenant_id))
        session.execute(sa.text("SELECT 1"))
        session.commit()
    with SessionLocal() as session:  # fresh session, no tenant bound -> owner, sees everything
        role = session.execute(sa.text("SELECT current_user")).scalar()
        setting = session.execute(sa.text("SELECT current_setting('app.current_tenant_id', true)")).scalar()
        assert role != "tender_app_rls"
        assert not setting


def test_api_requests_run_under_rls_role_with_tenant_context(client, tenants):
    """Authenticated API requests are bound to the caller's tenant in PostgreSQL."""
    if not rls_available():
        pytest.skip("RLS role not available (database user lacks CREATEROLE)")
    from fastapi import Depends

    from app.api.dependencies import get_current_user
    from app.db.session import get_db
    from app.main import app

    def probe(user=Depends(get_current_user), db=Depends(get_db)):
        return {
            "role": db.execute(sa.text("SELECT current_user")).scalar(),
            "tenant": db.execute(sa.text("SELECT current_setting('app.current_tenant_id', true)")).scalar(),
            "unfiltered_cases": db.execute(sa.text("SELECT count(*) FROM tender_cases")).scalar(),
        }

    app.router.add_api_route("/__test__/rls-probe", probe, methods=["GET"])
    try:
        a = client.get("/__test__/rls-probe", headers=tenants["a"].reviewer).json()
        b = client.get("/__test__/rls-probe", headers=tenants["b"].reviewer).json()
    finally:
        app.router.routes = [r for r in app.router.routes if getattr(r, "path", "") != "/__test__/rls-probe"]
    assert a == {"role": "tender_app_rls", "tenant": tenants["a"].tenant_id, "unfiltered_cases": 1}
    assert b == {"role": "tender_app_rls", "tenant": tenants["b"].tenant_id, "unfiltered_cases": 0}


def test_small_tenant_search_not_starved_by_large_tenant(client):
    """HNSW scans a fixed candidate list across all tenants; the tenant filter
    must not leave a small tenant with empty results (iterative index scan)."""
    big = create_org(client, "Big Archive Co")
    small = create_org(client, "Small Bidder Co")
    many = [f"Big archive paragraph {i} about network switches, routers and helpdesk services." for i in range(600)]
    client.post("/knowledge-base/documents", headers=big.editor, data={"source_type": "past_bid"},
                files=[f.upload("archive.docx", f.docx_bytes(many), f.DOCX_MIME)])
    client.post("/knowledge-base/documents", headers=small.editor, data={"source_type": "past_bid"},
                files=[f.upload("ours.docx", f.docx_bytes([
                    "We provide network switches with a five year warranty.",
                    "Our helpdesk services run around the clock.",
                    "Routers are configured by certified engineers.",
                ]), f.DOCX_MIME)])
    results = client.post("/knowledge-base/search", headers=small.admin,
                          json={"query": "network switches routers helpdesk services", "limit": 5}).json()["results"]
    assert {r["document_name"] for r in results} == {"ours.docx"}
    assert len(results) == 3
    assert results == sorted(results, key=lambda r: r["score"], reverse=True)


def test_vector_search_enables_iterative_hnsw_scan(clean_db):
    """Filtered HNSW queries must keep scanning until enough tenant rows are found."""
    from app.ai.retrievers import PgVectorRetriever, iterative_scan_supported
    from app.ai.schemas import VectorSearchRequest

    with SessionLocal() as session:
        if not iterative_scan_supported(session):
            pytest.skip("pgvector < 0.8 (falls back to a larger ef_search)")
        PgVectorRetriever(session).search(VectorSearchRequest(tenant_id=str(uuid.uuid4()), query_vector=[0.1] * 384))
        assert session.execute(sa.text("SHOW hnsw.iterative_scan")).scalar() == "relaxed_order"
        assert int(session.execute(sa.text("SHOW hnsw.ef_search")).scalar()) >= 100
        session.rollback()
        assert session.execute(sa.text("SHOW hnsw.iterative_scan")).scalar() == "off"  # transaction-local
