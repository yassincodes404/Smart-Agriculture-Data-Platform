import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

from app.main import app

# Tests run inside docker compose exec typically, mapping to the internal mysql host
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", 
    "mysql+pymysql://agri_user:agri_pass@mysql:3306/test_agriculture"
)

# Engine configured for testing
engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def client():
    """
    Global setup for FastAPI TestClient.
    Scope is session so we reuse the same client structure.
    """
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="function")
def db_session():
    """
    Creates a fresh database session for a test and rolls back the transaction 
    afterwards to guarantee isolation.
    """
    connection = engine.connect()
    transaction = connection.begin()
    
    # Bind the session exclusively to this transaction connection
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    # Teardown
    session.close()
    transaction.rollback()
    connection.close()
