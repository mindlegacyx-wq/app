"""Biblioteca de exercícios (Fase 16).

Catálogo em código, como as conquistas: sem tabela para manter e sem depender de internet.
Cada exercício traz o que o app precisa saber para registrar carga direito:

- `load_mode`: como o peso é digitado (total, por lado da barra, ou peso do corpo).
- `bar_weight`: peso da barra quando é por lado (olímpica 20 kg, W 10 kg).
- `increment`: de quanto em quanto faz sentido subir carga nesse exercício.
- `icon` e `muscle`: para a tela de escolha ficar visual e agrupada.
"""

from dataclasses import dataclass

# Grupos na ordem em que aparecem na tela de escolha.
MUSCLES: tuple[tuple[str, str], ...] = (
    ("chest", "Peito"),
    ("back", "Costas"),
    ("shoulders", "Ombros"),
    ("biceps", "Bíceps"),
    ("triceps", "Tríceps"),
    ("legs", "Pernas"),
    ("glutes", "Glúteos"),
    ("core", "Abdômen"),
    ("cardio", "Cardio"),
    ("full", "Corpo inteiro"),
)
MUSCLE_LABELS = dict(MUSCLES)


@dataclass(frozen=True)
class Goal:
    """Objetivo do treino → faixa de repetições, séries e descanso.

    Números das diretrizes de treino de força (ACSM 2026 e revisões): força usa carga alta e
    poucas repetições com descanso longo; hipertrofia fica na faixa média; resistência/definição
    usa mais repetições com descanso curto. O usuário pode mudar tudo depois — isto é só o
    ponto de partida, para ninguém ficar preso em "3 × 12" por falta de opção.
    """

    key: str
    label: str
    hint: str
    reps: str
    sets: int
    rest: int


GOALS: tuple[Goal, ...] = (
    Goal("strength", "Força", "Carga alta, poucas repetições", "4-6", 4, 180),
    Goal("hypertrophy", "Hipertrofia", "Crescer músculo", "8-12", 3, 90),
    Goal("endurance", "Resistência", "Definição e fôlego", "15-20", 3, 45),
    Goal("power", "Potência", "Movimento explosivo", "3-5", 4, 150),
)
GOALS_BY_KEY = {g.key: g for g in GOALS}


@dataclass(frozen=True)
class LibraryExercise:
    key: str
    name: str
    muscle: str
    icon: str  # barbell · dumbbell · machine · cable · body · kettlebell · run · bike · rope
    load_mode: str  # total · per_side · bodyweight
    bar_weight: int  # kg da barra (0 quando não se aplica)
    increment: float  # kg por degrau
    rest: int  # descanso sugerido, em segundos


def _bar(key: str, name: str, muscle: str, rest: int = 120, bar: int = 20) -> LibraryExercise:
    # Degrau de 5 kg = uma anilha de 2,5 de cada lado, que é como a academia funciona.
    return LibraryExercise(key, name, muscle, "barbell", "per_side", bar, 5.0, rest)


def _db(key: str, name: str, muscle: str, rest: int = 90) -> LibraryExercise:
    return LibraryExercise(key, name, muscle, "dumbbell", "total", 0, 2.0, rest)


def _mc(key: str, name: str, muscle: str, rest: int = 90) -> LibraryExercise:
    return LibraryExercise(key, name, muscle, "machine", "total", 0, 5.0, rest)


def _cb(key: str, name: str, muscle: str, rest: int = 75) -> LibraryExercise:
    return LibraryExercise(key, name, muscle, "cable", "total", 0, 2.5, rest)


def _bw(key: str, name: str, muscle: str, rest: int = 75) -> LibraryExercise:
    return LibraryExercise(key, name, muscle, "body", "bodyweight", 0, 2.5, rest)


CATALOG: tuple[LibraryExercise, ...] = (
    # Peito
    _bar("supino_reto", "Supino reto", "chest"),
    _bar("supino_inclinado", "Supino inclinado", "chest"),
    _bar("supino_declinado", "Supino declinado", "chest"),
    _db("supino_halter", "Supino com halteres", "chest"),
    _db("supino_inclinado_halter", "Supino inclinado com halteres", "chest"),
    _db("crucifixo", "Crucifixo", "chest"),
    _mc("crucifixo_maquina", "Voador (peck deck)", "chest"),
    _cb("crossover", "Crossover", "chest"),
    _bw("flexao", "Flexão de braço", "chest"),
    _mc("supino_maquina", "Supino na máquina", "chest"),
    # Costas
    _bar("remada_curvada", "Remada curvada", "back"),
    _db("remada_unilateral", "Remada unilateral (serrote)", "back"),
    _mc("puxada_frente", "Puxada frente (pulley)", "back"),
    _mc("puxada_triangulo", "Puxada triângulo", "back"),
    _mc("remada_baixa", "Remada baixa", "back"),
    _mc("remada_maquina", "Remada na máquina", "back"),
    _bw("barra_fixa", "Barra fixa", "back", rest=120),
    _bar("levantamento_terra", "Levantamento terra", "back", rest=180),
    _cb("pullover", "Pullover na polia", "back"),
    _mc("pulldown_braco_reto", "Pulldown com braço reto", "back"),
    # Ombros
    _bar("desenvolvimento_barra", "Desenvolvimento com barra", "shoulders"),
    _db("desenvolvimento_halter", "Desenvolvimento com halteres", "shoulders"),
    _db("elevacao_lateral", "Elevação lateral", "shoulders", rest=60),
    _db("elevacao_frontal", "Elevação frontal", "shoulders", rest=60),
    _db("crucifixo_inverso", "Crucifixo inverso", "shoulders", rest=60),
    _cb("face_pull", "Face pull", "shoulders", rest=60),
    _bar("encolhimento", "Encolhimento (trapézio)", "shoulders"),
    _mc("desenvolvimento_maquina", "Desenvolvimento na máquina", "shoulders"),
    # Bíceps
    _bar("rosca_direta", "Rosca direta", "biceps", rest=75, bar=10),
    _db("rosca_alternada", "Rosca alternada", "biceps", rest=60),
    _db("rosca_martelo", "Rosca martelo", "biceps", rest=60),
    _bar("rosca_scott", "Rosca scott", "biceps", rest=75, bar=10),
    _cb("rosca_polia", "Rosca na polia", "biceps", rest=60),
    _db("rosca_concentrada", "Rosca concentrada", "biceps", rest=60),
    # Tríceps
    _cb("triceps_corda", "Tríceps corda", "triceps", rest=60),
    _cb("triceps_barra", "Tríceps barra (polia)", "triceps", rest=60),
    _bar("triceps_testa", "Tríceps testa", "triceps", rest=75, bar=10),
    _db("triceps_frances", "Tríceps francês", "triceps", rest=60),
    _bw("mergulho", "Mergulho no banco", "triceps", rest=75),
    _bw("paralelas", "Paralelas", "triceps", rest=90),
    _db("triceps_coice", "Tríceps coice", "triceps", rest=60),
    # Pernas
    _bar("agachamento_livre", "Agachamento livre", "legs", rest=180),
    _mc("leg_press", "Leg press", "legs", rest=150),
    _mc("cadeira_extensora", "Cadeira extensora", "legs"),
    _mc("mesa_flexora", "Mesa flexora", "legs"),
    _mc("cadeira_flexora", "Cadeira flexora", "legs"),
    _bar("agachamento_hack", "Hack", "legs", rest=150),
    _db("afundo", "Afundo", "legs", rest=120),
    _db("bulgaro", "Búlgaro", "legs", rest=120),
    _bar("stiff", "Stiff", "legs", rest=150),
    _mc("panturrilha_sentado", "Panturrilha sentado", "legs", rest=60),
    _mc("panturrilha_em_pe", "Panturrilha em pé", "legs", rest=60),
    _bw("agachamento_livre_corpo", "Agachamento livre (sem peso)", "legs"),
    # Glúteos
    _bar("elevacao_pelvica", "Elevação pélvica", "glutes", rest=120),
    _mc("cadeira_abdutora", "Cadeira abdutora", "glutes", rest=60),
    _cb("gluteo_polia", "Glúteo na polia", "glutes", rest=60),
    _mc("coice_maquina", "Coice na máquina", "glutes", rest=60),
    # Abdômen
    _bw("abdominal_supra", "Abdominal supra", "core", rest=45),
    _bw("prancha", "Prancha", "core", rest=45),
    _bw("elevacao_pernas", "Elevação de pernas", "core", rest=45),
    _cb("abdominal_polia", "Abdominal na polia", "core", rest=45),
    _bw("prancha_lateral", "Prancha lateral", "core", rest=45),
    LibraryExercise(
        "abdominal_roda", "Abdominal com roda", "core", "body", "bodyweight", 0, 2.5, 60
    ),
    # Cardio
    LibraryExercise("esteira", "Esteira", "cardio", "run", "bodyweight", 0, 1.0, 0),
    LibraryExercise("corrida", "Corrida na rua", "cardio", "run", "bodyweight", 0, 1.0, 0),
    LibraryExercise("bike", "Bicicleta", "cardio", "bike", "bodyweight", 0, 1.0, 0),
    LibraryExercise("eliptico", "Elíptico", "cardio", "bike", "bodyweight", 0, 1.0, 0),
    LibraryExercise("pular_corda", "Pular corda", "cardio", "rope", "bodyweight", 0, 1.0, 30),
    LibraryExercise("escada", "Escada / simulador", "cardio", "run", "bodyweight", 0, 1.0, 0),
    # Corpo inteiro
    LibraryExercise("burpee", "Burpee", "full", "body", "bodyweight", 0, 2.5, 60),
    LibraryExercise(
        "kettlebell_swing", "Kettlebell swing", "full", "kettlebell", "total", 0, 4.0, 75
    ),
    LibraryExercise("thruster", "Thruster", "full", "barbell", "per_side", 20, 2.5, 120),
    LibraryExercise("remada_alta", "Remada alta", "full", "barbell", "per_side", 20, 2.5, 90),
)

BY_KEY = {e.key: e for e in CATALOG}
