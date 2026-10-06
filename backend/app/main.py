from fastapi import FastAPI
from sqlalchemy import text

from app.db.session import engine
from app.api.auth import router as auth_router


app = FastAPI(
    title="Tender Intelligence API",
    version="0.1.0",
)

app.include_router(auth_router)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "tender-intelligence-api",
    }


@app.get("/health/database")
def database_health_check():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        value = result.scalar()

    return {
        "database": "ok",
        "result": value,
    }