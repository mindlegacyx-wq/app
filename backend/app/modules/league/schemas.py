import datetime as dt

from pydantic import BaseModel

from app.modules.league.models import Outcome, Tier


class MemberOut(BaseModel):
    key: str  # "you" ou a chave do robô
    name: str
    is_bot: bool
    tagline: str | None
    xp: int
    rank: int
    is_you: bool


class LastResultOut(BaseModel):
    week_start: dt.date
    tier: Tier
    rank: int
    xp: int
    outcome: Outcome
    next_tier: Tier
    seen: bool


class LeagueOut(BaseModel):
    tier: Tier
    week_start: dt.date
    week_end: dt.date
    days_left: int  # dias até a virada (0 = encerra hoje à noite)
    members: list[MemberOut]
    your_rank: int
    your_xp: int
    promotion_slots: int  # quantos sobem
    relegation_slots: int  # quantos caem
    can_promote: bool  # falso no topo
    can_relegate: bool  # falso na base
    to_next_rank: int | None  # XP para alcançar quem está logo acima
    last_result: LastResultOut | None
