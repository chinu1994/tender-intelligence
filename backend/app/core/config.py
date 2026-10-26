"""Application settings.

All configuration (secrets, credentials, provider selection) comes from the
environment, typically populated from a ``.env`` file via Docker Compose.
Nothing secret is hard-coded here; defaults are safe development values.
"""
from __future__ import annotations

import os


def _bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return int(value)


class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "Tender Intelligence")
    # development | test | staging | production
    APP_ENV: str = os.getenv("APP_ENV", "development").strip().lower()
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:3000")

    # --- AI provider selection (provider-agnostic SPI, see app/ai) ---------
    # Prefer AI_PROVIDER; fall back to LLM_PROVIDER for older .env files.
    AI_PROVIDER: str = os.getenv("AI_PROVIDER") or os.getenv("LLM_PROVIDER", "mock")
    # mock | openai_compatible
    EMBEDDING_PROVIDER: str = os.getenv("EMBEDDING_PROVIDER", "mock")
    # pgvector (production) | mock (in-memory fixtures)
    VECTOR_RETRIEVER: str = os.getenv("VECTOR_RETRIEVER", "pgvector")

    # Generic OpenAI-compatible endpoints (Ollama, vLLM, TEI, hosted APIs...).
    LLM_API_BASE_URL: str = os.getenv("LLM_API_BASE_URL", "")
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "")
    EMBEDDING_API_BASE_URL: str = os.getenv("EMBEDDING_API_BASE_URL", "")
    EMBEDDING_API_KEY: str = os.getenv("EMBEDDING_API_KEY", "")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "")

    # Groq preset (OpenAI-compatible)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    GROQ_BASE_URL: str = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")

    # --- Database --------------------------------------------------------
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "postgres")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "tender_intelligence")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "tender_user")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "")
    # Database-level tenant isolation (PostgreSQL row-level security).
    RLS_ENABLED: bool = _bool("RLS_ENABLED", True)

    # --- Storage ---------------------------------------------------------
    DOCUMENT_STORAGE_PATH: str = os.getenv("DOCUMENT_STORAGE_PATH", "/app/storage")
    MAX_UPLOAD_SIZE_MB: int = _int("MAX_UPLOAD_SIZE_MB", 50)
    MAX_ZIP_MEMBERS: int = _int("MAX_ZIP_MEMBERS", 500)
    MAX_ZIP_TOTAL_UNCOMPRESSED_MB: int = _int("MAX_ZIP_TOTAL_UNCOMPRESSED_MB", 500)

    # --- Auth ------------------------------------------------------------
    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = _int("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", 30)
    REFRESH_TOKEN_EXPIRE_DAYS: int = _int("REFRESH_TOKEN_EXPIRE_DAYS", 30)
    # Optional Argon2 tuning (0 = library defaults). Only lowered in tests.
    ARGON2_TIME_COST: int = _int("ARGON2_TIME_COST", 0)
    ARGON2_MEMORY_COST: int = _int("ARGON2_MEMORY_COST", 0)
    # Return password-reset tokens in the API response (no mail server yet).
    # Never enabled in production regardless of this flag.
    EXPOSE_RESET_TOKEN: bool = _bool("EXPOSE_RESET_TOKEN", True)

    # --- Background jobs -------------------------------------------------
    REDIS_HOST: str = os.getenv("REDIS_HOST", "redis")
    REDIS_PORT: str = os.getenv("REDIS_PORT", "6379")
    # Run Celery tasks inline (tests / single-process demos).
    CELERY_TASK_ALWAYS_EAGER: bool = _bool("CELERY_TASK_ALWAYS_EAGER", False)
    # If the broker is unreachable, process inline instead of failing.
    TASK_SYNC_FALLBACK: bool = _bool("TASK_SYNC_FALLBACK", True)

    @property
    def DATABASE_URL(self) -> str:
        explicit = os.getenv("DATABASE_URL")
        if explicit:
            return explicit
        return (
            f"postgresql+psycopg://"
            f"{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/"
            f"{self.POSTGRES_DB}"
        )

    @property
    def REDIS_URL(self) -> str:
        return os.getenv("REDIS_URL") or f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        return origins or ["http://localhost:3000"]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV in {"production", "staging"}

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    def validate(self) -> None:
        """Fail fast on insecure or incomplete configuration."""
        problems: list[str] = []
        if len(self.JWT_SECRET) < 32:
            problems.append("JWT_SECRET must be set to at least 32 characters.")
        if self.JWT_ALGORITHM not in {"HS256", "HS384", "HS512"}:
            problems.append("JWT_ALGORITHM must be one of HS256/HS384/HS512.")
        if self.is_production and (0 < self.ARGON2_TIME_COST < 2 or 0 < self.ARGON2_MEMORY_COST < 19456):
            problems.append("Argon2 cost parameters are below OWASP minimums for production.")
        if self.is_production and self.CELERY_TASK_ALWAYS_EAGER:
            problems.append("CELERY_TASK_ALWAYS_EAGER must be disabled in production.")
        if problems:
            raise RuntimeError("Invalid configuration: " + " ".join(problems))


settings = Settings()
