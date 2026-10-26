"""Role-based access control matrix (Administrator / Editor / Reviewer)."""
import pytest

from tests import factories as f
from tests.conftest import create_org

ALLOWED = {"admin", "editor", "reviewer"}


@pytest.fixture()
def world(client):
    org = create_org(client, "Rbac Org")
    case = client.post("/tender-cases", headers=org.editor, json={"name": "RBAC case"}).json()
    upload = client.post(
        f"/tender-cases/{case['id']}/documents",
        headers=org.editor,
        files=[f.upload("rfp.pdf", f.simple_rfp_pdf(), f.PDF_MIME)],
    ).json()
    requirements = client.get(f"/tender-cases/{case['id']}/requirements", headers=org.admin).json()
    workspace = client.get(f"/tender-cases/{case['id']}/proposal", headers=org.admin).json()
    issue = client.post(
        f"/tender-cases/{case['id']}/proposal/issues", headers=org.admin, json={"title": "Check insurance"}
    ).json()
    users = client.get("/users", headers=org.admin).json()
    return {
        "org": org,
        "case": case["id"],
        "document": upload[0]["id"],
        "requirement": requirements[0]["id"],
        "section": workspace["sections"][0]["id"],
        "issue": issue["id"],
        "reviewer_user": next(u["id"] for u in users if u["role"] == "reviewer"),
    }


# (method, path template, json body, roles that are allowed)
MATRIX = [
    ("GET", "/users", None, {"admin"}),
    ("POST", "/users", {"email": "new-{role}@rbac.example.com", "password": "Str0ng-Passw0rd!", "role": "reviewer"}, {"admin"}),
    ("PATCH", "/users/{reviewer_user}", {"role": "reviewer"}, {"admin"}),
    ("GET", "/tender-cases", None, ALLOWED),
    ("POST", "/tender-cases", {"name": "New case"}, {"admin", "editor"}),
    ("PATCH", "/tender-cases/{case}", {"description": "updated"}, {"admin", "editor"}),
    ("GET", "/tender-cases/{case}/documents", None, ALLOWED),
    ("POST", "/tender-cases/{case}/documents/{document}/reprocess", None, {"admin", "editor"}),
    ("POST", "/tender-cases/{case}/extract-requirements", None, {"admin", "editor"}),
    ("GET", "/tender-cases/{case}/requirements", None, ALLOWED),
    ("GET", "/tender-cases/{case}/extraction", None, ALLOWED),
    ("PATCH", "/requirements/{requirement}", {"review_note": "checked"}, {"admin", "reviewer"}),
    ("GET", "/tender-cases/{case}/proposal", None, ALLOWED),
    ("PATCH", "/proposal/sections/{section}", {"content": "Draft text"}, {"admin", "editor"}),
    ("POST", "/tender-cases/{case}/proposal/sections", {"title": "Annex"}, {"admin", "editor"}),
    ("POST", "/tender-cases/{case}/proposal/issues", {"title": "Open point"}, {"admin", "editor"}),
    ("PATCH", "/proposal/issues/{issue}", {"resolved": True}, {"admin", "editor"}),
    ("POST", "/tender-cases/{case}/proposal/approve", None, {"admin", "reviewer"}),
    ("GET", "/tender-cases/{case}/proposal/export.docx", None, ALLOWED),
    ("GET", "/tender-cases/{case}/proposal/export.xlsx", None, ALLOWED),
    ("GET", "/knowledge-base/documents", None, ALLOWED),
    ("POST", "/knowledge-base/search", {"query": "insurance"}, ALLOWED),
    ("GET", "/dashboard/summary", None, ALLOWED),
]


@pytest.mark.parametrize("role", ["admin", "editor", "reviewer"])
@pytest.mark.parametrize("method,path,body,allowed", MATRIX, ids=[f"{m} {p}" for m, p, _, _ in MATRIX])
def test_role_matrix(client, world, role, method, path, body, allowed):
    headers = getattr(world["org"], role)
    url = path.format(**world)
    payload = None
    if body is not None:
        payload = {k: (v.format(role=role) if isinstance(v, str) else v) for k, v in body.items()}
    response = client.request(method, url, headers=headers, json=payload)
    if role in allowed:
        # Business rules (e.g. the approval gate) may still refuse with 4xx, but never 401/403.
        assert response.status_code not in (401, 403), (role, url, response.text)
    else:
        assert response.status_code == 403, (role, url, response.status_code, response.text)


@pytest.mark.parametrize("role,expected", [("admin", 204), ("editor", 403), ("reviewer", 403)])
def test_only_admin_deletes_cases(client, world, role, expected):
    response = client.delete(f"/tender-cases/{world['case']}", headers=getattr(world["org"], role))
    assert response.status_code == expected


@pytest.mark.parametrize("role,expected", [("admin", 201), ("editor", 201), ("reviewer", 403)])
def test_upload_permissions(client, world, role, expected):
    response = client.post(
        f"/tender-cases/{world['case']}/documents",
        headers=getattr(world["org"], role),
        files=[f.upload("extra.docx", f.docx_bytes(["Bidders must provide references."]), f.DOCX_MIME)],
    )
    assert response.status_code == expected


@pytest.mark.parametrize("role,expected", [("admin", 201), ("editor", 201), ("reviewer", 403)])
def test_knowledge_base_upload_permissions(client, world, role, expected):
    response = client.post(
        "/knowledge-base/documents",
        headers=getattr(world["org"], role),
        files=[f.upload("bid.docx", f.docx_bytes(["We deliver 24x7 support."]), f.DOCX_MIME)],
        data={"source_type": "past_bid"},
    )
    assert response.status_code == expected
