from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración leída desde variables de entorno o archivo `.env`."""
    app_env: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    database_url: str = "postgresql+psycopg://cotizaciones:cotizaciones@localhost:5432/cotizaciones"
    database_echo: bool = False
    cors_origins: str = Field(default="*")
    socket_cors_origins: str = Field(default="*")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    def parsed_cors_origins(self) -> list[str]:
        """Convierte CORS separados por coma al formato que espera FastAPI."""
        return _parse_origins(self.cors_origins)

    def parsed_socket_origins(self) -> list[str]:
        """Permite configurar CORS de Socket.IO o reutilizar el de la API."""
        return _parse_origins(self.socket_cors_origins or self.cors_origins)


def _parse_origins(value: str) -> list[str]:
    """Acepta `*` o una lista separada por comas sin espacios extra."""
    if not value or value.strip() == "*":
        return ["*"]
    return [origin.strip() for origin in value.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cachea settings para no releer `.env` en cada import/request."""
    return Settings()
