"""Datas no fuso do usuário.

Regra do produto: instantes ficam em UTC; o "dia" é sempre o dia civil no fuso do usuário.
Registros diários (checklist, acordar) só podem ser feitos para hoje ou ontem: ontem existe
para quem fecha a rotina da noite depois da meia-noite. Nunca para o futuro, nunca mais atrás.
"""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.errors import AppError


class DateNotAllowedError(AppError):
    code = "date_not_allowed"


def now_utc() -> datetime:
    return datetime.now(UTC)


def user_today(timezone: str, at: datetime | None = None) -> date:
    at = at or now_utc()
    return at.astimezone(ZoneInfo(timezone)).date()


def local_to_utc(day: date, at_time: time, timezone: str) -> datetime:
    """Combina data + hora local do usuário e devolve o instante em UTC."""
    return datetime.combine(day, at_time, tzinfo=ZoneInfo(timezone)).astimezone(UTC)


def ensure_recordable_day(day: date, timezone: str) -> None:
    """Hoje ou ontem no fuso do usuário; caso contrário, erro 400."""
    today = user_today(timezone)
    if day > today:
        raise DateNotAllowedError("Não dá para registrar um dia que ainda não chegou.")
    if day < today - timedelta(days=1):
        raise DateNotAllowedError("Só é possível registrar hoje ou ontem.")


def weekday_index(day: date) -> int:
    """0 = segunda … 6 = domingo (mesma convenção de days_of_week no banco)."""
    return day.weekday()
