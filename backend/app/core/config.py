import os


class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "Tender Intelligence")
    AI_PROVIDER: str = "mock"

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

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+psycopg://"
            f"{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:5432/"
            f"{self.POSTGRES_DB}"
        )


settings = Settings()