from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://moss:moss@localhost:5432/moss"

    # Accepted `iss` values, comma separated. Keycloak issues tokens under whatever
    # host the browser reached it on, so a laptop on localhost and a phone on the LAN
    # address get different issuers from the same realm.
    keycloak_issuers: str = "http://localhost:8080/realms/moss"
    # Container-internal realm URL used only to fetch the JWKS, when the public
    # issuer host is not resolvable from inside the compose network.
    keycloak_internal_issuer: str = ""
    keycloak_audience: str = "account"

    @property
    def issuer_list(self) -> list[str]:
        return [i.strip().rstrip("/") for i in self.keycloak_issuers.split(",") if i.strip()]

    @property
    def jwks_url(self) -> str:
        # Every accepted issuer is the same realm, so any of them serves the same keys.
        base = self.keycloak_internal_issuer or self.issuer_list[0]
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
