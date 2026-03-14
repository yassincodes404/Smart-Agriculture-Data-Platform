import requests
import pytest

# Base Nginx Gateway URL
BASE_URL = "http://localhost"

def test_stack_routing():
    """
    Simulates a ping bouncing completely through the architecture stack:
    Local System -> Nginx Reverse Proxy -> FastAPI Backend
    """
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=5)
        # Assuming the backend container is up
        assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"
        
        data = response.json()
        assert data.get("status") == "backend running"
    except requests.exceptions.ConnectionError:
        pytest.fail("Failed to connect to Nginx gateway. Ensure docker compose is running natively.")

def test_stack_db_connectivity():
    """
    Simulates a ping bouncing through:
    Local System -> Nginx Reverse Proxy -> FastAPI Backend -> MySQL Database
    """
    try:
        response = requests.get(f"{BASE_URL}/api/health/db", timeout=5)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "success"
        assert data.get("result") == 1
    except requests.exceptions.ConnectionError:
        pytest.fail("Failed to connect to Nginx gateway. Ensure docker compose is running natively.")
