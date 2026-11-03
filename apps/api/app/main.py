"""FastAPI backend for the IoT Simulator.

Stdlib-first: sqlite3 for persistence, hashlib.pbkdf2_hmac for password
hashing, secrets for session tokens. No external DB servers required.
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

EXAMPLE_IDS: list[str] = [
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

EXAMPLE_DETAILS: list[dict[str, str]] = [
    {"id": "led-blink", "name": "Arduino LED Blink", "description": "Blink an LED on D13 every second."},
    {"id": "traffic-light", "name": "Traffic Light Controller", "description": "Red / amber / green traffic light sequence."},
    {"id": "button-led", "name": "Push-Button LED Control", "description": "Button on D2 controls an LED on D13."},
    {"id": "dht22-display", "name": "DHT22 Temperature & Humidity", "description": "Read DHT22 and print to serial / display."},
    {"id": "ultrasonic", "name": "Ultrasonic Distance Measurement", "description": "HC-SR04 distance measurement."},
    {"id": "servo-control", "name": "Servo Motor Control", "description": "Sweep a servo 0-180 degrees."},
    {"id": "lcd1602", "name": "LCD 16x2 Display", "description": "Print text to an I2C LCD 16x2."},
    {"id": "rgb-led", "name": "RGB LED Control", "description": "PWM colour mixing on an RGB LED."},
    {"id": "logic-and", "name": "Digital Logic — AND Gate", "description": "Two switches through a 74HC08 AND gate."},
    {"id": "esp32-mqtt", "name": "ESP32 MQTT Temperature Telemetry", "description": "Virtual MQTT telemetry (partial emulation)."},
]

VALID_VISIBILITIES = {"private", "public", "shared"}
RATE_LIMIT = 120
RATE_WINDOW_SECONDS = 60

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

_db_lock = Lock()


def _db_path() -> str:
    return os.environ.get("API_DB_PATH", "./iot_sim.db")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_conn() -> sqlite3.Connection:
    path = _db_path()
    # Allow :memory: and file paths; ensure parent dir exists for files.
    if path not in (":memory:",) and not path.startswith("file:"):
        parent = os.path.dirname(os.path.abspath(path))
        os.makedirs(parent, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db() -> None:
    with _db_lock:
        conn = _get_conn()
        try:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    token TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    data TEXT NOT NULL,
                    visibility TEXT NOT NULL DEFAULT 'private',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS project_versions (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    version INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    data TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
                CREATE INDEX IF NOT EXISTS idx_versions_project ON project_versions(project_id);
                CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
                """
            )
            conn.commit()
        finally:
            conn.close()


# ---------------------------------------------------------------------------
# Password / token helpers
# ---------------------------------------------------------------------------

def _hash_password(password: str, salt_hex: str | None = None) -> tuple[str, str]:
    if salt_hex is None:
        salt = secrets.token_bytes(16)
        salt_hex = salt.hex()
    else:
        salt = bytes.fromhex(salt_hex)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return digest.hex(), salt_hex


def _verify_password(password: str, expected_hash: str, salt_hex: str) -> bool:
    candidate, _ = _hash_password(password, salt_hex)
    return secrets.compare_digest(candidate, expected_hash)


def _create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    conn = _get_conn()
    try:
        conn.execute(
            "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
            (token, user_id, _now()),
        )
        conn.commit()
    finally:
        conn.close()
    return token


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)

    @field_validator("email")
    @classmethod
    def _email_must_contain_at(cls, v: str) -> str:
        v = v.strip()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("invalid email address")
        return v.lower()

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be empty")
        return v.strip()


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)

    @field_validator("email")
    @classmethod
    def _norm_email(cls, v: str) -> str:
        return v.strip().lower()


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1)
    data: dict[str, Any] = Field(...)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be empty")
        return v.strip()

    @field_validator("data")
    @classmethod
    def _data_not_empty(cls, v: dict[str, Any]) -> dict[str, Any]:
        if not v:
            raise ValueError("data must not be empty")
        return v


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    data: Optional[dict[str, Any]] = Field(default=None)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("name must not be empty")
        return v.strip() if v is not None else v

    @field_validator("data")
    @classmethod
    def _data_not_empty(cls, v: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
        if v is not None and not v:
            raise ValueError("data must not be empty")
        return v


class ShareRequest(BaseModel):
    visibility: str = Field(...)

    @field_validator("visibility")
    @classmethod
    def _valid_visibility(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in VALID_VISIBILITIES:
            raise ValueError(f"visibility must be one of {sorted(VALID_VISIBILITIES)}")
        return v


# ---------------------------------------------------------------------------
# App + middleware
# ---------------------------------------------------------------------------

app = FastAPI(title="IoT Simulator API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple in-memory rate limiter: 120 req/min per IP
_rate_buckets: dict[str, list[float]] = defaultdict(list)
_rate_lock = Lock()


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    with _rate_lock:
        bucket = _rate_buckets[client_ip]
        # Drop timestamps outside the window
        cutoff = now - RATE_WINDOW_SECONDS
        while bucket and bucket[0] < cutoff:
            bucket.pop(0)
        if len(bucket) >= RATE_LIMIT:
            return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})
        bucket.append(now)
    return await call_next(request)


@app.on_event("startup")
def _on_startup() -> None:
    init_db()


# Ensure DB exists even when startup events are not run (e.g. some test setups)
init_db()


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------

def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[len("Bearer "):].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT u.id, u.email, u.name, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?",
            (token,),
        ).fetchone()
    finally:
        conn.close()
    if row is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"id": row["id"], "email": row["email"], "name": row["name"], "created_at": row["created_at"]}


def _project_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    try:
        data = json.loads(row["data"])
    except (json.JSONDecodeError, TypeError):
        data = {}
    return {
        "id": row["id"],
        "owner_id": row["owner_id"],
        "name": row["name"],
        "data": data,
        "visibility": row["visibility"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _get_project_or_404(project_id: str) -> dict[str, Any]:
    conn = _get_conn()
    try:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    finally:
        conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_row_to_dict(row)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@app.post("/api/auth/register", status_code=201)
def register(payload: RegisterRequest) -> dict[str, Any]:
    init_db()
    pw_hash, salt = _hash_password(payload.password)
    user_id = str(uuid.uuid4())
    now = _now()
    conn = _get_conn()
    try:
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (payload.email,)).fetchone()
        if existing is not None:
            raise HTTPException(status_code=409, detail="Email already registered")
        conn.execute(
            "INSERT INTO users (id, email, name, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, payload.email, payload.name, pw_hash, salt, now),
        )
        conn.commit()
    finally:
        conn.close()
    token = _create_session(user_id)
    return {"id": user_id, "email": payload.email, "name": payload.name, "token": token}


@app.post("/api/auth/login")
def login(payload: LoginRequest) -> dict[str, Any]:
    init_db()
    conn = _get_conn()
    try:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (payload.email,)).fetchone()
    finally:
        conn.close()
    if row is None or not _verify_password(payload.password, row["password_hash"], row["salt"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = _create_session(row["id"])
    return {"id": row["id"], "email": row["email"], "name": row["name"], "token": token}


@app.get("/api/auth/me")
def me(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {"id": current_user["id"], "email": current_user["email"], "name": current_user["name"]}


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

@app.post("/api/projects", status_code=201)
def create_project(
    payload: ProjectCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    project_id = str(uuid.uuid4())
    now = _now()
    conn = _get_conn()
    try:
        conn.execute(
            "INSERT INTO projects (id, owner_id, name, data, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (project_id, current_user["id"], payload.name, json.dumps(payload.data), "private", now, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    finally:
        conn.close()
    assert row is not None
    return _project_row_to_dict(row)


@app.get("/api/projects")
def list_projects(current_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    conn = _get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM projects WHERE owner_id = ? ORDER BY updated_at DESC",
            (current_user["id"],),
        ).fetchall()
    finally:
        conn.close()
    return [_project_row_to_dict(r) for r in rows]


@app.get("/api/projects/{project_id}")
def get_project(
    project_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    project = _get_project_or_404(project_id)
    if project["owner_id"] == current_user["id"] or project["visibility"] in ("public", "shared"):
        return project
    raise HTTPException(status_code=403, detail="Forbidden")


@app.put("/api/projects/{project_id}")
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if payload.name is None and payload.data is None:
        raise HTTPException(status_code=422, detail="At least one of name or data must be provided")
    project = _get_project_or_404(project_id)
    if project["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can update this project")
    new_name = payload.name if payload.name is not None else project["name"]
    new_data = payload.data if payload.data is not None else project["data"]
    now = _now()
    conn = _get_conn()
    try:
        conn.execute(
            "UPDATE projects SET name = ?, data = ?, updated_at = ? WHERE id = ?",
            (new_name, json.dumps(new_data), now, project_id),
        )
        # Create a version row recording this update
        row = conn.execute(
            "SELECT COALESCE(MAX(version), 0) AS maxv FROM project_versions WHERE project_id = ?",
            (project_id,),
        ).fetchone()
        next_version = int(row["maxv"]) + 1
        conn.execute(
            "INSERT INTO project_versions (id, project_id, version, name, data, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), project_id, next_version, new_name, json.dumps(new_data), now),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    finally:
        conn.close()
    assert updated is not None
    return _project_row_to_dict(updated)


@app.delete("/api/projects/{project_id}")
def delete_project(
    project_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    project = _get_project_or_404(project_id)
    if project["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can delete this project")
    conn = _get_conn()
    try:
        conn.execute("DELETE FROM project_versions WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
    finally:
        conn.close()
    return {"deleted": True, "id": project_id}


@app.get("/api/projects/{project_id}/versions")
def list_versions(
    project_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    project = _get_project_or_404(project_id)
    if project["owner_id"] != current_user["id"] and project["visibility"] not in ("public", "shared"):
        raise HTTPException(status_code=403, detail="Forbidden")
    conn = _get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM project_versions WHERE project_id = ? ORDER BY version ASC",
            (project_id,),
        ).fetchall()
    finally:
        conn.close()
    result: list[dict[str, Any]] = []
    for r in rows:
        try:
            data = json.loads(r["data"])
        except (json.JSONDecodeError, TypeError):
            data = {}
        result.append(
            {
                "id": r["id"],
                "project_id": r["project_id"],
                "version": r["version"],
                "name": r["name"],
                "data": data,
                "created_at": r["created_at"],
            }
        )
    return result


@app.post("/api/projects/{project_id}/share")
def share_project(
    project_id: str,
    payload: ShareRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    project = _get_project_or_404(project_id)
    if project["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can share this project")
    now = _now()
    conn = _get_conn()
    try:
        conn.execute(
            "UPDATE projects SET visibility = ?, updated_at = ? WHERE id = ?",
            (payload.visibility, now, project_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    finally:
        conn.close()
    assert row is not None
    return _project_row_to_dict(row)


# ---------------------------------------------------------------------------
# Examples
# ---------------------------------------------------------------------------

@app.get("/api/examples")
def list_examples(format: str = "ids") -> Any:
    """Return example ids by default; ?format=full returns detailed objects."""
    if format == "full":
        return EXAMPLE_DETAILS
    return list(EXAMPLE_IDS)


@app.get("/api/examples/{example_id}")
def get_example(example_id: str) -> dict[str, Any]:
    for item in EXAMPLE_DETAILS:
        if item["id"] == example_id:
            return item
    raise HTTPException(status_code=404, detail="Example not found")
