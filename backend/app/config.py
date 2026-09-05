from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://moss:moss@localhost:5432/moss"

    # Signs and verifies our own tokens. The default is a development value; the
    # production overlay refuses to start without a real one in .env.
    jwt_secret: str = "dev-only-insecure-secret"
    jwt_days: int = 30

    # Set to false only for local debugging, to skip token validation entirely.
    auth_enabled: bool = True

    cors_origins: str = "http://localhost:4200"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
