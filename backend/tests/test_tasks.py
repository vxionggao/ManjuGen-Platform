from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_login():
    r = client.post("/api/users/login", json={"username": "u", "password": "p"})
    assert r.status_code == 200
    assert "token" in r.json()

def test_create_task():
    r = client.post("/api/admin/models", json={"name": "doubao-seedream-4.5", "endpoint_id": "", "type": "image", "concurrency_quota": 1, "request_quota": 100})
    mid = r.json()["id"]
    r = client.post("/api/tasks", json={"type": "image", "model_id": mid, "prompt": "a", "images": []})
    assert r.status_code == 200
    assert r.json()["status"] == "queued"
