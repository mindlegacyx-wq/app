"""Regras de XP e níveis. Funções puras: sem banco, fáceis de testar e de ajustar.

Princípio: **o XP é derivado do dia, não um saldo à parte.** Cada dia vale um tanto de XP
calculado a partir do que foi planejado e concluído (o mesmo que alimenta o percentual de
disciplina). Nada de "moeda" separada que possa divergir do número honesto — se o usuário
desmarca um item, o XP daquele dia diminui junto.

Por que assim:
- Impossível inflar XP repetindo ação (marcar/desmarcar não acumula).
- O histórico se autocura: se um dia é recalculado, o XP acompanha.
- Funciona com a fila offline sem risco de contar duas vezes.
"""

from __future__ import annotations

from dataclasses import dataclass

# Quanto vale cada item concluído, por área. Treino e estudo valem mais porque custam mais
# (uma sessão inteira vs. um item de rotina).
WEIGHTS: dict[str, int] = {
    "wake": 20,  # acordar e confirmar no horário
    "routines": 8,  # cada item de rotina
    "tasks": 10,  # cada tarefa
    "goals": 12,  # cada ação de meta
    "workout": 25,  # cada treino concluído
    "study": 25,  # cada sessão de estudo concluída
}

BONUS_TARGET = 50  # bateu a meta de disciplina do dia
BONUS_PERFECT = 30  # fez 100% do que planejou
STREAK_STEP = 5  # por dia de sequência...
STREAK_CAP = 10  # ...contando no máximo 10 dias (+50)

# Curva de nível: subir do nível L para L+1 custa BASE + STEP*(L-1).
# L1→2 = 200, L5→6 = 400, L10→11 = 650, L20→21 = 1150.
LEVEL_BASE = 200
LEVEL_STEP = 50
MAX_LEVEL = 99

# Faixas de patente. O título é o que o usuário fala em voz alta ("tô no Implacável").
TITLES: tuple[tuple[int, str], ...] = (
    (1, "Recruta"),
    (5, "Constante"),
    (10, "Focado"),
    (15, "Disciplinado"),
    (20, "Implacável"),
    (30, "Inabalável"),
    (40, "Lenda"),
    (50, "Mito"),
)


def xp_for_day(
    breakdown: dict[str, dict[str, int]], pct: int, hit_target: bool, streak_day: int
) -> int:
    """XP de um dia a partir da mesma foto que gera o percentual de disciplina."""
    total = 0
    for kind, counts in breakdown.items():
        weight = WEIGHTS.get(kind)
        if weight is None:  # chave desconhecida (ex.: "missing") é ignorada
            continue
        total += max(0, int(counts.get("completed", 0))) * weight
    if hit_target:
        total += BONUS_TARGET
    if pct >= 100:
        total += BONUS_PERFECT
    total += min(max(streak_day, 0), STREAK_CAP) * STREAK_STEP
    return total


def span_for_level(level: int) -> int:
    """Quanto XP custa sair do nível `level` para o próximo."""
    return LEVEL_BASE + LEVEL_STEP * (max(level, 1) - 1)


def total_for_level(level: int) -> int:
    """XP acumulado necessário para *atingir* este nível (nível 1 = 0)."""
    n = max(level, 1) - 1
    return LEVEL_BASE * n + LEVEL_STEP * n * (n - 1) // 2


def title_for_level(level: int) -> str:
    title = TITLES[0][1]
    for floor, name in TITLES:
        if level >= floor:
            title = name
    return title


@dataclass(frozen=True)
class LevelInfo:
    level: int
    title: str
    into_level: int  # XP já feito dentro do nível atual
    span: int  # XP total do nível atual
    to_next: int  # quanto falta para o próximo


def level_for(total_xp: int) -> LevelInfo:
    total = max(0, total_xp)
    level = 1
    while level < MAX_LEVEL and total >= total_for_level(level + 1):
        level += 1
    into = total - total_for_level(level)
    span = span_for_level(level)
    if level >= MAX_LEVEL:  # nível máximo: barra cheia, nada a alcançar
        return LevelInfo(
            level=level, title=title_for_level(level), into_level=span, span=span, to_next=0
        )
    return LevelInfo(
        level=level, title=title_for_level(level), into_level=into, span=span, to_next=span - into
    )
