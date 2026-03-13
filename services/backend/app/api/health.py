from fastapi import APIRouter
from sqlalchemy import text
from app.db.session import engine

router = APIRouter()

@router.get("/api/health")
def health_check():
    return {"status": "backend running"}


@router.get("/api/health/db")
def test_db_connection():
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            return {"status": "success", "result": result.scalar()}
    except Exception as e:
        return {"status": "error", "message": str(e)}