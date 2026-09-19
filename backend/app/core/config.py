"""Configuração via variáveis de ambiente (.env). Nenhum segredo no código."""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: Literal["dev", "test", "prod"] = "dev"
    debug: bool = False

    database_url: str = "postgresql+asyncpg://disciplina:disciplina@127.0.0.1:5432/disciplina"

    # Auth
    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    refresh_cookie_name: str = "disciplina_refresh"
    cookie_secure: bool = True  # False só em dev sem HTTPS

    # CORS (origens do PWA em dev; em prod o Caddy serve tudo no mesmo domínio)
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]

    # Rate limit das rotas de autenticação (por IP)
    auth_rate_limit_per_minute: int = 10

    # Padrões de novos usuários
    default_timezone: str = "America/Sao_Paulo"
    default_discipline_target: int = 80

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [o.strip() for o in value.split(",") if o.strip()]
        return value

    @property
    def is_prod(self) -> bool:
        return self.env == "prod"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
