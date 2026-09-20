"""Catálogo de conquistas (Fase 15).

Cada selo é uma **regra sobre números que já existem** — sequência, dias perfeitos, XP, nível,
divisão da liga, itens concluídos por área. Nada é contado à parte, então nenhuma conquista pode
divergir do histórico: apagar um dia mexe no progresso do selo junto.

No banco fica só *quando* cada selo foi desbloqueado (para a data e para avisar uma vez só).
"""

from dataclasses import dataclass

# Famílias definem a cor do selo na tela.
FAMILIES = ("streak", "perfect", "level", "league", "area")


@dataclass(frozen=True)
class Achievement:
    key: str
    name: str
    hint: str  # como se consegue, em português direto
    family: str
    metric: str  # campo de Metrics
    target: int
    icon: str  # nome do desenho no front


CATALOG: tuple[Achievement, ...] = (
    # Sequência — o coração do app
    Achievement(
        "streak_3",
        "Pegando o ritmo",
        "3 dias seguidos na meta",
        "streak",
        "best_streak",
        3,
        "flame",
    ),
    Achievement(
        "streak_7",
        "Semana inteira",
        "7 dias seguidos na meta",
        "streak",
        "best_streak",
        7,
        "flame",
    ),
    Achievement(
        "streak_14",
        "Duas semanas",
        "14 dias seguidos na meta",
        "streak",
        "best_streak",
        14,
        "flame",
    ),
    Achievement(
        "streak_30",
        "Um mês sem falhar",
        "30 dias seguidos na meta",
        "streak",
        "best_streak",
        30,
        "flame",
    ),
    Achievement(
        "streak_100",
        "Cem dias",
        "100 dias seguidos na meta",
        "streak",
        "best_streak",
        100,
        "flame",
    ),
    # Dias redondos
    Achievement(
        "perfect_1",
        "Dia redondo",
        "Fechar um dia com 100%",
        "perfect",
        "perfect_days",
        1,
        "target",
    ),
    Achievement(
        "perfect_10",
        "Dez redondos",
        "Fechar 10 dias com 100%",
        "perfect",
        "perfect_days",
        10,
        "target",
    ),
    Achievement(
        "perfect_30",
        "Trinta redondos",
        "Fechar 30 dias com 100%",
        "perfect",
        "perfect_days",
        30,
        "target",
    ),
    Achievement(
        "days_30",
        "Um mês de registro",
        "Fechar 30 dias, cumpridos ou não",
        "perfect",
        "closed_days",
        30,
        "calendar",
    ),
    Achievement(
        "days_100",
        "Cem dias de registro",
        "Fechar 100 dias",
        "perfect",
        "closed_days",
        100,
        "calendar",
    ),
    # Nível e XP
    Achievement(
        "level_5",
        "Nível 5",
        "Chegar ao nível 5",
        "level",
        "level",
        5,
        "bolt",
    ),
    Achievement(
        "level_10",
        "Nível 10",
        "Chegar ao nível 10",
        "level",
        "level",
        10,
        "bolt",
    ),
    Achievement(
        "level_20",
        "Nível 20",
        "Chegar ao nível 20",
        "level",
        "level",
        20,
        "bolt",
    ),
    Achievement(
        "xp_10k",
        "Dez mil",
        "Somar 10.000 XP",
        "level",
        "total_xp",
        10_000,
        "bolt",
    ),
    # Liga
    Achievement(
        "league_week",
        "Entrou na disputa",
        "Terminar a primeira semana de liga",
        "league",
        "weeks_played",
        1,
        "shield",
    ),
    Achievement(
        "league_promote",
        "Primeira subida",
        "Subir de divisão uma vez",
        "league",
        "promotions",
        1,
        "shield",
    ),
    Achievement(
        "league_win",
        "Campeão da semana",
        "Terminar uma semana em 1º",
        "league",
        "wins",
        1,
        "crown",
    ),
    Achievement(
        "league_gold",
        "Ouro",
        "Alcançar a divisão Ouro",
        "league",
        "best_tier",
        3,
        "shield",
    ),
    Achievement(
        "league_diamond",
        "Diamante",
        "Alcançar a divisão Diamante",
        "league",
        "best_tier",
        5,
        "crown",
    ),
    # Áreas
    Achievement(
        "wake_25",
        "De pé",
        "Confirmar que levantou 25 vezes",
        "area",
        "wake_done",
        25,
        "sun",
    ),
    Achievement(
        "routines_300",
        "Trezentos pequenos",
        "Concluir 300 itens de rotina",
        "area",
        "routines_done",
        300,
        "check",
    ),
    Achievement(
        "tasks_100",
        "Cem tarefas",
        "Concluir 100 tarefas",
        "area",
        "tasks_done",
        100,
        "check",
    ),
    Achievement(
        "workout_20",
        "Vinte treinos",
        "Concluir 20 treinos",
        "area",
        "workout_done",
        20,
        "dumbbell",
    ),
    Achievement(
        "study_20",
        "Vinte sessões",
        "Concluir 20 sessões de estudo",
        "area",
        "study_done",
        20,
        "book",
    ),
    Achievement(
        "goals_50",
        "Cinquenta passos",
        "Concluir 50 ações de metas",
        "area",
        "goals_done",
        50,
        "flag",
    ),
)

BY_KEY = {a.key: a for a in CATALOG}
