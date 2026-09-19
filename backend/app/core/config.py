"""Configuração via variáveis de ambiente (.env). Nenhum segredo no código."""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from app.core.dburl import normalize_database_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: Literal["dev", "test", "prod"] = "dev"
    debug: bool = False

    # Aceita o formato dos provedores (postgres://…?sslmode=require); ver app/core/dburl.py.
    database_url: str = "postgresql+asyncpg://disciplina:disciplina@127.0.0.1:5432/disciplina"
    # Pool pequeno: bancos gratuitos limitam conexões (Aiven Free: 20). Por worker.
    db_pool_size: int = Field(default=5, ge=1, le=50)
    db_max_overflow: int = Field(default=5, ge=0, le=50)

    # Deploy em um container só: se definido, a API também serve o PWA compilado (dist/).
    static_dir: str = ""

    # Auth
    # Cadastro fechado: com um código definido, só cria conta quem informar o código
    # (uso pessoal / poucos usuários). Vazio = cadastro aberto.
    signup_invite_code: str = ""
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

    # Fechamento do dia: um dia fica aberto até esta hora do dia seguinte (fuso do usuário)
    day_close_hour: int = Field(default=3, ge=0, le=6)
    # Jobs em processo: finalização de dias vencidos e disparo de alarmes (desligados em testes)
    scheduler_enabled: bool = True
    scheduler_interval_minutes: int = 5

    # Despertador
    alarm_missed_minutes: int = Field(default=60, ge=5, le=240)  # sem confirmar → perdido
    # Web Push (VAPID). Gere com `python -m app.core.push` e cole no .env.
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:contato@disciplina.app"

    # IA (Fase 12): qualquer provedor compatível com a API da OpenAI (Groq, Gemini, Mistral,
    # OpenAI, Ollama…). Sem AI_API_KEY a funcionalidade aparece como "não configurada".
    ai_base_url: str = "https://api.groq.com/openai/v1"
    ai_api_key: str = ""
    ai_model: str = "llama-3.3-70b-versatile"
    ai_vision_model: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    ai_timeout_seconds: int = Field(default=90, ge=10, le=600)
    ai_max_images: int = Field(default=6, ge=1, le=12)
    ai_max_image_mb: int = Field(default=8, ge=1, le=25)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [o.strip() for o in value.split(",") if o.strip()]
        return value

    @property
    def is_prod(self) -> bool:
        return self.env == "prod"

    @property
    def sqlalchemy_url(self) -> str:
        return normalize_database_url(self.database_url)[0]

    @property
    def db_connect_args(self) -> dict[str, object]:
        return normalize_database_url(self.database_url)[1]

    @property
    def invite_required(self) -> bool:
        return bool(self.signup_invite_code.strip())

    @property
    def push_enabled(self) -> bool:
        return bool(self.vapid_public_key and self.vapid_private_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
