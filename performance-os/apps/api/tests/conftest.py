from __future__ import annotations

import os
import tempfile

import pytest

# Point the app at an isolated temp SQLite DB BEFORE importing app modules.
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}"
os.environ["AI_PROVIDER"] = "mock"
os.environ["HEALTH_PROVIDER"] = "mock"
os.environ["CALENDAR_PROVIDER"] = "mock"


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_client(client):
    import uuid
    email = f"user_{uuid.uuid4().hex[:8]}@test.app"
    r = client.post("/api/auth/register", json={"email": email, "password": "password123"})
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    yield client
    client.headers.pop("Authorization", None)
