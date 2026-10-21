import os


class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "Tender Intelligence")
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    # Prefer AI_PROVIDER; fall back to LLM_PROVIDER for compatibility with older .env
    AI_PROVIDER: str = os.getenv("AI_PROVIDER") or os.getenv("LLM_PROVIDER", "mock")

    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "postgres")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    DOCUMENT_STORAGE_PATH: str = os.getenv("DOCUMENT_STORAGE_PATH", "/app/storage")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "tender_intelligence")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "tender_user")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "")

    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30")
    )

    # Groq
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    GROQ_BASE_URL: str = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+psycopg://"
            f"{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/"
            f"{self.POSTGRES_DB}"
        )


settings = Settings()