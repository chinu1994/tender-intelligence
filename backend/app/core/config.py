import os


class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "Tender Intelligence")

    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "postgres")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "tender_intelligence")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "tender_user")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "")

    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30")
    )

    # ---- AI layer (each part is switchable on its own) ----
    # LLM_PROVIDER:       mock | groq
    # EMBEDDING_PROVIDER: mock | local
    # RETRIEVER_PROVIDER: mock | pgvector   (pgvector is added in Step 4)
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "mock")
    EMBEDDING_PROVIDER: str = os.getenv("EMBEDDING_PROVIDER", "mock")
    RETRIEVER_PROVIDER: str = os.getenv("RETRIEVER_PROVIDER", "mock")

    # Vector size. Must match the pgvector column size.
    # 384 = BAAI/bge-small-en-v1.5 (the default local model).
    EMBEDDING_DIM: int = int(os.getenv("EMBEDDING_DIM", "384"))
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")

    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    GROQ_BASE_URL: str = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
    LLM_TIMEOUT_SECONDS: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "60"))
    LLM_MAX_CHUNKS_PER_CALL: int = int(os.getenv("LLM_MAX_CHUNKS_PER_CALL", "10"))

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+psycopg://"
            f"{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:5432/"
            f"{self.POSTGRES_DB}"
        )


settings = Settings()
