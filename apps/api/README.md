# IoT Simulator — API

FastAPI backend for the IoT Simulator. Stdlib-first persistence
(`sqlite3`), password hashing with `hashlib.pbkdf2_hmac`, and
server-side session tokens (`secrets.token_urlsafe`). No external
database server is required.

## Run locally

```bash
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# httpx + pytest are only needed for tests
pip install httpx pytest
uvicorn app.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/health` → `{"status": "ok"}`

## Configuration

| Env var       | Default       | Description              |
|---------------|---------------|--------------------------|
| `API_DB_PATH` | `./iot_sim.db`| SQLite database file path|

## Endpoints

- `GET /health`
- `POST /api/auth/register` `{email, password, name}` → `{id, email, name, token}`
- `POST /api/auth/login` → same shape; `401` on bad credentials
- `GET /api/auth/me` (Bearer token)
- `POST /api/projects` / `GET /api/projects` / `GET|PUT|DELETE /api/projects/{id}`
- `GET /api/projects/{id}/versions` — PUT creates a version row
- `POST /api/projects/{id}/share` `{visibility: private|public|shared}`
- `GET /api/examples` — example ids; `?format=full` for details

Rate limit: 120 requests/min per IP → `429`.

## Tests

```bash
PYTHONPATH=. pytest tests/ -v
```

## Docker

```bash
docker build -t iot-simulator-api .
docker run -p 8000:8000 iot-simulator-api
```
