def test_health_endpoint(client):
    """
    Verifies the stateless backend routing is alive and accessible.
    """
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "backend running"}

def test_db_health_endpoint(client):
    """
    Verifies the backend container can ping the internal stateful database.
    Note: For this to pass, the database must be successfully online.
    """
    response = client.get("/api/health/db")
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert response.json()["result"] == 1
