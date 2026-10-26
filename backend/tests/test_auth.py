"""Authentication: registration, JWT sessions, refresh rotation, password reset."""
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import settings
from tests.conftest import auth_headers, create_org

PASSWORD = "Str0ng-Passw0rd!"


def register(client, email="owner@example.com", company="Example Ltd", password=PASSWORD):
    return client.post("/auth/register", json={"company_name": company, "email": email, "password": password})


def test_register_creates_tenant_and_admin(client):
    response = register(client)
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "admin"
    assert body["access_token"] and body["refresh_token"]

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["tenant_id"] == body["tenant_id"]
    assert me.json()["organization"] == "Example Ltd"


def test_register_rejects_duplicate_email_case_insensitively(client):
    assert register(client, email="Owner@Example.com").status_code == 200
    duplicate = register(client, email="owner@example.COM", company="Other")
    assert duplicate.status_code == 409


def test_register_validates_input(client):
    assert register(client, password="short").status_code == 422
    assert register(client, email="not-an-email").status_code == 422


def test_login_success_and_failures(client):
    register(client, email="owner@example.com")
    ok = client.post("/auth/login", json={"email": "OWNER@example.com", "password": PASSWORD})
    assert ok.status_code == 200
    assert ok.json()["token_type"] == "bearer"

    wrong = client.post("/auth/login", json={"email": "owner@example.com", "password": "wrong-password"})
    unknown = client.post("/auth/login", json={"email": "nobody@example.com", "password": PASSWORD})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"] == "Invalid email or password"


def test_protected_endpoints_require_token(client):
    assert client.get("/tender-cases").status_code == 401
    assert client.get("/tender-cases", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_expired_and_forged_tokens_rejected(client):
    body = register(client).json()
    expired = jwt.encode(
        {"sub": body["user_id"], "tenant_id": body["tenant_id"], "role": "admin", "type": "access",
         "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        settings.JWT_SECRET, algorithm="HS256",
    )
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Token has expired"

    forged = jwt.encode(
        {"sub": body["user_id"], "tenant_id": body["tenant_id"], "role": "admin", "type": "access",
         "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        "a-completely-different-secret-of-sufficient-length", algorithm="HS256",
    )
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_token_with_mismatched_tenant_claim_is_rejected(client):
    a = register(client, email="a@example.com", company="Alpha Ltd").json()
    b = register(client, email="b@example.com", company="Beta Ltd").json()
    # Validly signed token for user A that claims tenant B.
    token = jwt.encode(
        {"sub": a["user_id"], "tenant_id": b["tenant_id"], "role": "admin", "type": "access",
         "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        settings.JWT_SECRET, algorithm="HS256",
    )
    assert client.get("/tender-cases", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_refresh_rotates_and_revokes_old_token(client):
    body = register(client).json()
    first = client.post("/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert first.status_code == 200
    new_refresh = first.json()["refresh_token"]
    assert new_refresh != body["refresh_token"]

    reused = client.post("/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert reused.status_code == 401
    assert client.post("/auth/refresh", json={"refresh_token": new_refresh}).status_code == 200


def test_logout_revokes_refresh_token(client):
    body = register(client).json()
    assert client.post("/auth/logout", json={"refresh_token": body["refresh_token"]}).status_code == 200
    assert client.post("/auth/refresh", json={"refresh_token": body["refresh_token"]}).status_code == 401


def test_password_reset_flow(client):
    body = register(client, email="owner@example.com").json()
    reset = client.post("/auth/forgot-password", json={"email": "owner@example.com"})
    assert reset.status_code == 200
    token = reset.json()["reset_token"]

    # Unknown e-mails get the same message and no token.
    unknown = client.post("/auth/forgot-password", json={"email": "ghost@example.com"})
    assert unknown.json()["message"] == reset.json()["message"]
    assert "reset_token" not in unknown.json()

    done = client.post("/auth/reset-password", json={"token": token, "new_password": "N3w-Passw0rd!"})
    assert done.status_code == 200
    # token is single-use and all refresh sessions are revoked
    assert client.post("/auth/reset-password", json={"token": token, "new_password": "Other-Pass1!"}).status_code == 400
    assert client.post("/auth/refresh", json={"refresh_token": body["refresh_token"]}).status_code == 401
    assert client.post("/auth/login", json={"email": "owner@example.com", "password": PASSWORD}).status_code == 401
    assert client.post("/auth/login", json={"email": "owner@example.com", "password": "N3w-Passw0rd!"}).status_code == 200


def test_reset_token_hidden_in_production(client, monkeypatch):
    register(client, email="owner@example.com")
    monkeypatch.setattr(settings, "APP_ENV", "production")
    response = client.post("/auth/forgot-password", json={"email": "owner@example.com"})
    assert response.status_code == 200
    assert "reset_token" not in response.json()


def test_deactivated_user_is_locked_out(client):
    org = create_org(client, "Lockout Co")
    users = client.get("/users", headers=org.admin).json()
    editor = next(u for u in users if u["role"] == "editor")

    assert client.patch(f"/users/{editor['id']}", headers=org.admin, json={"is_active": False}).status_code == 200
    assert client.get("/tender-cases", headers=org.editor).status_code == 403
    login = client.post("/auth/login", json={"email": org.emails["editor"], "password": "Str0ng-Passw0rd!"})
    assert login.status_code == 403

    assert client.patch(f"/users/{editor['id']}", headers=org.admin, json={"is_active": True}).status_code == 200
    assert client.get("/tender-cases", headers=auth_headers(client, org.emails["editor"], "Str0ng-Passw0rd!")).status_code == 200


def test_admin_safeguards(client):
    org = create_org(client, "Safe Co")
    me = client.get("/auth/me", headers=org.admin).json()
    assert client.patch(f"/users/{me['id']}", headers=org.admin, json={"role": "editor"}).status_code == 400
    assert client.patch(f"/users/{me['id']}", headers=org.admin, json={"is_active": False}).status_code == 400

    # promote the reviewer, then the original admin may be demoted by them
    users = client.get("/users", headers=org.admin).json()
    reviewer = next(u for u in users if u["role"] == "reviewer")
    assert client.patch(f"/users/{reviewer['id']}", headers=org.admin, json={"role": "admin"}).status_code == 200
    new_admin = auth_headers(client, org.emails["reviewer"], "Str0ng-Passw0rd!")
    assert client.patch(f"/users/{me['id']}", headers=new_admin, json={"role": "editor"}).status_code == 200
    # the last remaining admin cannot be removed
    assert client.patch(f"/users/{reviewer['id']}", headers=new_admin, json={"role": "editor"}).status_code == 400


def test_health_endpoints(client):
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/health/database").json()["database"] == "ok"
