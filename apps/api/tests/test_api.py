"""Tests for the IoT Simulator API.

Uses an isolated temporary SQLite DB (API_DB_PATH set before importing app).
"""
import os
import tempfile

# Must be set BEFORE importing app.main so the app uses the test DB.
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["API_DB_PATH"] = _tmp.name

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)

PROJECT_DATA = {
    "schemaVersion": 1,
    "components": [{"id": "led1", "type": "led"}],
    "wires": [],
    "files": [{"name": "sketch.ino", "content": "void setup(){} void loop(){}"}],
}


def _register(email: str = "alice@example.com", password: str = "secret123", name: str = "Alice"):
    return client.post("/api/auth/register", json={"email": email, "password": password, "name": name})


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_register_login_me():
    r = _register("bob@example.com", "hunter2pass", "Bob")
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["email"] == "bob@example.com"
    assert body["name"] == "Bob"
    assert body["id"]
    assert body["token"]

    # Login with same credentials
    r2 = client.post("/api/auth/login", json={"email": "bob@example.com", "password": "hunter2pass"})
    assert r2.status_code == 200, r2.text
    token = r2.json()["token"]
    assert token

    # /me with token
    r3 = client.get("/api/auth/me", headers=_auth_headers(token))
    assert r3.status_code == 200
    me = r3.json()
    assert me["email"] == "bob@example.com"
    assert me["name"] == "Bob"
    assert me["id"] == body["id"]


def test_wrong_password_401():
    _register("carol@example.com", "correct-pass", "Carol")
    r = client.post("/api/auth/login", json={"email": "carol@example.com", "password": "wrong-pass"})
    assert r.status_code == 401


def test_me_unauthenticated_401():
    r = client.get("/api/auth/me")
    assert r.status_code == 401
    r2 = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid-token-xyz"})
    assert r2.status_code == 401


def test_project_create_list_get_update_version():
    reg = _register("dave@example.com", "dave-pass-1", "Dave").json()
    headers = _auth_headers(reg["token"])

    # Create
    r = client.post("/api/projects", json={"name": "Blink", "data": PROJECT_DATA}, headers=headers)
    assert r.status_code == 201, r.text
    proj = r.json()
    assert proj["name"] == "Blink"
    assert proj["data"] == PROJECT_DATA
    assert proj["owner_id"] == reg["id"]
    assert proj["visibility"] == "private"
    assert proj["created_at"]
    assert proj["updated_at"]
    pid = proj["id"]

    # List own
    r = client.get("/api/projects", headers=headers)
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()]
    assert pid in ids

    # Get
    r = client.get(f"/api/projects/{pid}", headers=headers)
    assert r.status_code == 200
    assert r.json()["id"] == pid

    # Update -> creates a version row
    updated_data = {**PROJECT_DATA, "components": [{"id": "led1", "type": "led"}, {"id": "r1", "type": "resistor"}]}
    r = client.put(f"/api/projects/{pid}", json={"name": "Blink v2", "data": updated_data}, headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Blink v2"
    assert r.json()["data"] == updated_data

    # Versions recorded
    r = client.get(f"/api/projects/{pid}/versions", headers=headers)
    assert r.status_code == 200
    versions = r.json()
    assert len(versions) >= 1
    assert versions[-1]["data"] == updated_data
    assert versions[-1]["version"] >= 1


def test_project_delete():
    reg = _register("erin@example.com", "erin-pass-1", "Erin").json()
    headers = _auth_headers(reg["token"])
    pid = client.post("/api/projects", json={"name": "ToDelete", "data": PROJECT_DATA}, headers=headers).json()["id"]

    r = client.delete(f"/api/projects/{pid}", headers=headers)
    assert r.status_code == 200, r.text

    r = client.get(f"/api/projects/{pid}", headers=headers)
    assert r.status_code == 404


def test_share_makes_readable_by_another_user():
    owner = _register("owner@example.com", "owner-pass-1", "Owner").json()
    other = _register("other@example.com", "other-pass-1", "Other").json()
    owner_h = _auth_headers(owner["token"])
    other_h = _auth_headers(other["token"])

    pid = client.post("/api/projects", json={"name": "SharedProj", "data": PROJECT_DATA}, headers=owner_h).json()["id"]

    # Private: other user cannot read
    r = client.get(f"/api/projects/{pid}", headers=other_h)
    assert r.status_code in (403, 404)

    # Share as public
    r = client.post(f"/api/projects/{pid}/share", json={"visibility": "public"}, headers=owner_h)
    assert r.status_code == 200, r.text
    assert r.json()["visibility"] == "public"

    # Now other user can read
    r = client.get(f"/api/projects/{pid}", headers=other_h)
    assert r.status_code == 200
    assert r.json()["id"] == pid

    # Other user cannot update owner's project
    r = client.put(f"/api/projects/{pid}", json={"name": "Hijack", "data": PROJECT_DATA}, headers=other_h)
    assert r.status_code == 403


def test_unauthenticated_project_list_401():
    r = client.get("/api/projects")
    assert r.status_code == 401
    r = client.post("/api/projects", json={"name": "X", "data": PROJECT_DATA})
    assert r.status_code == 401


def test_validation_422():
    reg = _register("frank@example.com", "frank-pass-1", "Frank").json()
    headers = _auth_headers(reg["token"])

    # Missing name
    r = client.post("/api/projects", json={"data": PROJECT_DATA}, headers=headers)
    assert r.status_code == 422

    # Empty data
    r = client.post("/api/projects", json={"name": "Empty", "data": {}}, headers=headers)
    assert r.status_code == 422

    # Empty name
    r = client.post("/api/projects", json={"name": "", "data": PROJECT_DATA}, headers=headers)
    assert r.status_code == 422

    # Missing fields on register
    r = client.post("/api/auth/register", json={"email": "x@example.com"})
    assert r.status_code == 422


def test_examples():
    r = client.get("/api/examples")
    assert r.status_code == 200
    ids = r.json()
    assert ids == [
        "led-blink",
        "traffic-light",
        "button-led",
        "dht22-display",
        "ultrasonic",
        "servo-control",
        "lcd1602",
        "rgb-led",
        "logic-and",
        "esp32-mqtt",
    ]
    r2 = client.get("/api/examples?format=full")
    assert r2.status_code == 200
    full_ids = [e["id"] for e in r2.json()]
    assert full_ids == ids
