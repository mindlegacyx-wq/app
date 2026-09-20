from pydantic import BaseModel


class PlayerOut(BaseModel):
    """Estado do jogador: é o que alimenta a barra de XP no topo do app."""

    level: int
    title: str  # patente da faixa ("Focado", "Implacável"…)
    total_xp: int
    into_level: int  # XP feito dentro do nível atual
    level_span: int  # XP que o nível atual custa
    to_next: int  # quanto falta para subir
    xp_today: int
    max_level: bool
