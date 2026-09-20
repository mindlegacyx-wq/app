import datetime as dt

from pydantic import BaseModel


class AchievementOut(BaseModel):
    key: str
    name: str
    hint: str
    family: str
    icon: str
    target: int
    progress: int  # nunca passa do alvo
    unlocked: bool
    unlocked_at: dt.datetime | None
    seen: bool


class AchievementsOut(BaseModel):
    unlocked: int
    total: int
    items: list[AchievementOut]
