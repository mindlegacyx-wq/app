"""Os robôs da liga (Fase 14).

Decisão central: **os bots não existem no banco.** Cada um é gerado por uma semente
determinística — `(usuário, semana, divisão, posição)` — e o XP dele num instante é uma função
do relógio. Consequências:

- Zero tabelas e zero jobs para manter sete adversários vivos (importante no plano gratuito).
- O placar sobe sozinho ao longo do dia: cada robô tem um ritmo (madrugador, noturno…) e um
  alvo diário, então às 7h o madrugador já está na frente e o noturno ainda não saiu do lugar.
- A mesma semana recalculada dá exatamente o mesmo resultado, hoje ou daqui a um ano.

Eles são **robôs assumidos**: nome de máquina, rótulo "robô" na tela. Nada de inventar gente.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import date
from random import Random
from uuid import UUID

from app.modules.league.models import Tier

# Alvo de XP por dia em cada divisão (mínimo, máximo). Um dia cheio de verdade dá ~270 XP,
# então Diamante só se sustenta com quase tudo feito.
TIER_TARGETS: dict[Tier, tuple[int, int]] = {
    Tier.bronze: (55, 120),
    Tier.silver: (105, 180),
    Tier.gold: (155, 235),
    Tier.platinum: (205, 295),
    Tier.diamond: (255, 355),
}


@dataclass(frozen=True)
class BotProfile:
    key: str
    name: str
    tagline: str  # aparece na tela da liga; dá personalidade sem fingir ser gente
    rhythm: str  # early · steady · night · burst


PROFILES: tuple[BotProfile, ...] = (
    BotProfile("sentinela", "Sentinela", "Acorda antes do alarme.", "early"),
    BotProfile("farol", "Farol", "Começa cedo e não apaga.", "early"),
    BotProfile("bussola", "Bússola", "Nunca muda de direção.", "steady"),
    BotProfile("ancora", "Âncora", "Devagar, mas não solta.", "steady"),
    BotProfile("pistao", "Pistão", "Mesmo ritmo o dia inteiro.", "steady"),
    BotProfile("cometa", "Cometa", "Some de manhã, brilha à noite.", "night"),
    BotProfile("corujao", "Corujão", "A madrugada é dele.", "night"),
    BotProfile("turbina", "Turbina", "Explode em dois turnos.", "burst"),
    BotProfile("vulcao", "Vulcão", "Fica quieto e depois estoura.", "burst"),
    BotProfile("lince", "Lince", "Ataca quando você descuida.", "burst"),
)

BOTS_PER_LEAGUE = 6


def _seed(*parts: object) -> int:
    raw = "|".join(str(p) for p in parts).encode()
    return int.from_bytes(hashlib.sha256(raw).digest()[:8], "big")


@dataclass(frozen=True)
class Bot:
    key: str
    name: str
    tagline: str
    rhythm: str
    daily: tuple[int, ...]  # alvo de XP para cada dia da semana (segunda → domingo)


def draw(user_id: UUID, week_start: date, tier: Tier) -> list[Bot]:
    """Sorteia os seis adversários da semana. Mesmo sorteio sempre, para a mesma semana."""
    rnd = Random(_seed(user_id, week_start, tier.value))
    chosen = rnd.sample(PROFILES, BOTS_PER_LEAGUE)
    low, high = TIER_TARGETS[tier]
    bots: list[Bot] = []
    for index, profile in enumerate(chosen):
        r = Random(_seed(user_id, week_start, tier.value, index, profile.key))
        base = r.uniform(low, high)
        daily: list[int] = []
        for weekday in range(7):
            factor = r.uniform(0.82, 1.18)
            if r.random() < 0.14:  # todo robô tem um dia fraco de vez em quando
                factor *= 0.45
            if weekday >= 5:  # fim de semana rende um pouco menos
                factor *= r.uniform(0.7, 1.0)
            daily.append(max(0, round(base * factor)))
        bots.append(
            Bot(
                key=profile.key,
                name=profile.name,
                tagline=profile.tagline,
                rhythm=profile.rhythm,
                daily=tuple(daily),
            )
        )
    return bots


def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def progress_at(rhythm: str, minutes: int) -> float:
    """Quanto do alvo do dia o robô já entregou até este minuto (0 a 1). Nunca volta atrás."""
    h = minutes / 60
    if rhythm == "early":
        return _clamp01((h - 4.5) / 6.5)
    if rhythm == "night":
        return _clamp01(0.3 * _clamp01((h - 7) / 11) + 0.7 * _clamp01((h - 18) / 4.5))
    if rhythm == "burst":
        return _clamp01(0.55 * _clamp01((h - 6) / 3.5) + 0.45 * _clamp01((h - 17.5) / 3.5))
    return _clamp01((h - 6) / 16)  # steady


def xp_so_far(bot: Bot, days_done: int, today_minutes: int | None) -> int:
    """XP do robô na semana: dias fechados inteiros + a fatia de hoje conforme o relógio."""
    total = sum(bot.daily[:days_done])
    if today_minutes is not None and days_done < 7:
        total += round(bot.daily[days_done] * progress_at(bot.rhythm, today_minutes))
    return total
