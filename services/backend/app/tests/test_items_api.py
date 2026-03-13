from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_item():
    response = client.post("/items?name=test_item")
    assert response.status_code == 200

def test_get_items():
    response = client.get("/items")
    assert response.status_code == 200