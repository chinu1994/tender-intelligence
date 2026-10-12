from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.db.session import engine
from app.api.auth import router as auth_router
from fastapi.middleware.cors import CORSMiddleware
from app.api.dependencies import require_admin
from app.models import User
from fastapi import Depends
from app.api.dashboard import router as dashboard_router
from app.api.users import router as users_router


app = FastAPI(
    title="Tender Intelligence API",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    # Development only: LAN IP (192.168.x.x) se frontend kholne ke liye.
    # Production mein ise hata dena.
    allow_origin_regex=r"http://192\.168\.\d{1,3}\.\d{1,3}:3000",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(users_router)


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

@app.get("/test/admin")
def admin_test(
    current_user: User = Depends(require_admin),
):
    return {
        "message": "Admin access granted",
        "user": current_user.email,
        "role": current_user.role.value,
    }