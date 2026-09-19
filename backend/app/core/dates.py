"""Datas no fuso do usuário.

Regras do produto:
- Instantes ficam em UTC; o "dia" é sempre o dia civil no fuso do usuário.
- Um dia D fica **aberto para registro** (checks, tarefas, acordar) até as 03:00 de D+1 no
  fuso do usuário. É a janela de quem fecha a rotina da noite depois da meia-noite. Às 03:00
  o job finaliza D e o percentual daquele dia vira histórico. Nunca se registra no futuro.
"""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.config import get_settings
from app.core.errors import AppError


class DateNotAllowedError(AppError):
    code = "date_not_allowed"


def now_utc() -> datetime:
    return datetime.now(UTC)


def local_now(timezone: str, at: datetime | None = None) -> datetime:
    return (at or now_utc()).astimezone(ZoneInfo(timezone))


def user_today(timezone: str, at: datetime | None = None) -> date:
    return local_now(timezone, at).date()


def local_to_utc(day: date, at_time: time, timezone: str) -> datetime:
    """Combina data + hora local do usuário e devolve o instante em UTC."""
    return datetime.combine(day, at_time, tzinfo=ZoneInfo(timezone)).astimezone(UTC)


def close_cutoff_hour() -> int:
    return get_settings().day_close_hour


def last_finalizable_day(timezone: str, at: datetime | None = None) -> date:
    """Último dia que já passou do corte de 03:00 (e portanto pode ser finalizado)."""
    now = local_now(timezone, at)
    today = now.date()
    return (
        today - timedelta(days=1) if now.hour >= close_cutoff_hour() else today - timedelta(days=2)
    )


def is_day_open(day: date, timezone: str, at: datetime | None = None) -> bool:
    """Dia ainda aceita registros: é hoje, ou é ontem antes do corte."""
    today = user_today(timezone, at)
    if day > today:
        return False
    return day > last_finalizable_day(timezone, at)


def ensure_recordable_day(day: date, timezone: str) -> None:
    today = user_today(timezone)
    if day > today:
        raise DateNotAllowedError("Não dá para registrar um dia que ainda não chegou.")
    if not is_day_open(day, timezone):
        raise DateNotAllowedError(
            f"Esse dia já foi fechado. Registros valem até as {close_cutoff_hour():02d}:00 "
            "do dia seguinte."
        )


def weekday_index(day: date) -> int:
    """0 = segunda … 6 = domingo (mesma convenção de days_of_week no banco)."""
    return day.weekday()
