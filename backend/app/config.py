from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://moss:moss@localhost:5432/moss"

    # Public issuer — must equal the `iss` claim the browser's token carries.
    keycloak_issuer: str = "http://localhost:8080/realms/moss"
    # Container-internal realm URL used only to fetch the JWKS, when the public
    # issuer host is not resolvable from inside the compose network.
    keycloak_internal_issuer: str = ""
    keycloak_audience: str = "account"

    @property
    def jwks_url(self) -> str:
        base = self.keycloak_internal_issuer or self.keycloak_issuer
        return f"{base}/protocol/openid-connect/certs"
    # Set to false only for local debugging without a running Keycloak.
    auth_enabled: bool = True

    cors_origins: str = "http://localhost:4200"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
