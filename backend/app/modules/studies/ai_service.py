"""Estudos com IA (Fase 12): transcrição de fotos, materiais e geração de teoria, resoluções,
mapa mental e quiz a partir dos exercícios que a professora passou.

Regras:
- As fotos nunca são guardadas: viram texto (transcrição) que o usuário revisa e salva.
- A geração roda em segundo plano (BackgroundTasks) com sessão própria; a tela consulta o
  estado. Um tipo por vez por prova: gerar de novo substitui o anterior.
- `input_hash` guarda a impressão dos materiais usados; se eles mudarem, o material gerado
  aparece como desatualizado (`stale`), mas continua legível.
- A teoria é focada no que os exercícios exigem — não um livro inteiro.
"""

from __future__ import annotations

import hashlib
import logging
from collections.abc import Callable
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import ai
from app.core.config import get_settings
from app.core.dates import now_utc
from app.core.errors import ConflictError, NotFoundError
from app.modules.studies import service as studies_service
from app.modules.studies.models import (
    ArtifactKind,
    ArtifactStatus,
    Exam,
    StudyArtifact,
    StudyMaterial,
)
from app.modules.studies.schemas import (
    AIStatusOut,
    ArtifactOut,
    ExamAIOut,
    MaterialIn,
    MaterialOut,
    MaterialUpdate,
    TranscriptionOut,
)

log = logging.getLogger(__name__)

KIND_ORDER = [ArtifactKind.theory, ArtifactKind.solutions, ArtifactKind.mindmap, ArtifactKind.quiz]

SYSTEM = (
    "Você é um professor particular brasileiro, paciente e direto. Escreve em português do "
    "Brasil para um estudante do ensino médio/técnico. Nunca use LaTeX: escreva fórmulas em "
    "texto simples e legível no celular (x², √, ÷, ×, frações como 3/4). Seja fiel ao material "
    "enviado; se algo estiver ilegível ou faltando, diga isso em vez de inventar."
)


def status() -> AIStatusOut:
    s = get_settings()
    ok = ai.is_configured()
    return AIStatusOut(
        configured=ok,
        model=s.ai_model if ok else None,
        vision_model=s.ai_vision_model if ok else None,
    )


# --- Transcrição -------------------------------------------------------------------------


async def transcribe(images: list[bytes]) -> TranscriptionOut:
    s = get_settings()
    if not images:
        raise ConflictError("Envie pelo menos uma foto.")
    if len(images) > s.ai_max_images:
        raise ConflictError(f"No máximo {s.ai_max_images} fotos por vez.")
    for raw in images:
        if len(raw) > s.ai_max_image_mb * 1024 * 1024:
            raise ConflictError(f"Cada foto pode ter no máximo {s.ai_max_image_mb} MB.")
    prepared = [ai.prepare_image(raw) for raw in images]
    text = await ai.chat(
        ai.ChatRequest(
            system=SYSTEM,
            user=(
                "Transcreva fielmente TODOS os exercícios e enunciados que aparecem nestas fotos, "
                "em Markdown. Numere os exercícios como estão (ou sequencialmente se não houver "
                "numeração). Mantenha alternativas (a, b, c, d) e dados numéricos exatos. Descreva "
                "figuras/gráficos entre colchetes, por exemplo [figura: triângulo retângulo com "
                "catetos 3 e 4]. NÃO resolva nada e não comente: só a transcrição."
            ),
            images=prepared,
            max_tokens=4000,
        )
    )
    return TranscriptionOut(content=text, images=len(images))


# --- Materiais ---------------------------------------------------------------------------


async def list_materials(db: AsyncSession, exam_id: UUID) -> list[StudyMaterial]:
    rows = await db.scalars(
        select(StudyMaterial)
        .where(StudyMaterial.exam_id == exam_id)
        .order_by(StudyMaterial.created_at)
    )
    return list(rows)


async def add_material(
    db: AsyncSession, user_id: UUID, exam_id: UUID, data: MaterialIn
) -> StudyMaterial:
    e = await studies_service.get_exam(db, user_id, exam_id)
    if len(await list_materials(db, e.id)) >= 20:
        raise ConflictError("Limite de 20 materiais por prova.")
    m = StudyMaterial(
        user_id=user_id,
        exam_id=e.id,
        title=data.title,
        source=data.source,
        content=data.content.strip(),
    )
    db.add(m)
    await db.flush()
    return m


async def _get_material(
    db: AsyncSession, user_id: UUID, exam_id: UUID, material_id: UUID
) -> StudyMaterial:
    m = await db.get(StudyMaterial, material_id)
    if m is None or m.user_id != user_id or m.exam_id != exam_id:
        raise NotFoundError("Material não encontrado.")
    return m


async def update_material(
    db: AsyncSession, user_id: UUID, exam_id: UUID, material_id: UUID, data: MaterialUpdate
) -> StudyMaterial:
    m = await _get_material(db, user_id, exam_id, material_id)
    if data.title is not None:
        m.title = data.title
    if data.clear_title:
        m.title = None
    if data.content is not None:
        m.content = data.content.strip()
    m.updated_at = now_utc()
    await db.flush()
    return m


async def delete_material(
    db: AsyncSession, user_id: UUID, exam_id: UUID, material_id: UUID
) -> None:
    m = await _get_material(db, user_id, exam_id, material_id)
    await db.delete(m)
    await db.flush()


def materials_hash(materials: list[StudyMaterial]) -> str:
    h = hashlib.sha256()
    for m in materials:
        h.update(m.content.encode("utf-8"))
        h.update(b"\x00")
    return h.hexdigest()


# --- Artefatos ---------------------------------------------------------------------------


async def list_artifacts(db: AsyncSession, exam_id: UUID) -> dict[ArtifactKind, StudyArtifact]:
    rows = await db.scalars(select(StudyArtifact).where(StudyArtifact.exam_id == exam_id))
    return {a.kind: a for a in rows}


def _artifact_out(kind: ArtifactKind, a: StudyArtifact | None, current_hash: str) -> ArtifactOut:
    if a is None:
        return ArtifactOut(
            kind=kind,
            status=ArtifactStatus.queued,
            content_md=None,
            content_json=None,
            error=None,
            model=None,
            stale=False,
            updated_at=None,
        )
    return ArtifactOut(
        kind=kind,
        status=a.status,
        content_md=a.content_md,
        content_json=a.content_json,
        error=a.error,
        model=a.model,
        stale=a.status == ArtifactStatus.done and a.input_hash != current_hash,
        updated_at=a.updated_at,
    )


async def exam_ai(db: AsyncSession, user_id: UUID, exam_id: UUID) -> ExamAIOut:
    e = await studies_service.get_exam(db, user_id, exam_id)
    materials = await list_materials(db, e.id)
    artifacts = await list_artifacts(db, e.id)
    current = materials_hash(materials)
    configured = ai.is_configured()
    outs: list[ArtifactOut] = []
    for kind in KIND_ORDER:
        a = artifacts.get(kind)
        out = _artifact_out(kind, a, current)
        if a is None:
            out.status = ArtifactStatus.queued  # nunca gerado; a UI mostra "gerar"
        outs.append(out)
    return ExamAIOut(
        configured=configured,
        materials=[MaterialOut.model_validate(m) for m in materials],
        artifacts=outs,
        can_generate=configured and len(materials) > 0,
    )


# --- Geração -----------------------------------------------------------------------------


def _context(e: Exam, materials: list[StudyMaterial]) -> str:
    subject = e.subject.name if e.subject is not None and e.subject.deleted_at is None else None
    topics = ", ".join(t.title for t in e.topics) or "não informados"
    parts = [
        f"Prova/trabalho: {e.title}",
        f"Matéria: {subject or 'não informada'}",
        f"Conteúdos indicados pelo aluno: {topics}",
        "",
        "MATERIAL (exercícios/enunciados passados pela professora):",
    ]
    for i, m in enumerate(materials, 1):
        parts.append(f"\n--- Material {i}{f' · {m.title}' if m.title else ''} ---\n{m.content}")
    return "\n".join(parts)


PROMPTS: dict[ArtifactKind, tuple[str, bool, int]] = {
    ArtifactKind.theory: (
        "Com base no material abaixo, escreva um RESUMO TEÓRICO focado exatamente no que o aluno "
        "precisa saber para resolver esses exercícios — nada além disso. Estrutura em Markdown: "
        "um título curto; seções por conceito (##) na ordem em que aparecem nos exercícios; em "
        "cada seção: a ideia em 2–4 frases, a fórmula/regra em texto simples, um exemplo mínimo "
        "resolvido e um aviso de erro comum. Termine com '## Checklist antes da prova' com 5 a 8 "
        "itens. Máximo de ~700 palavras.\n\n",
        False,
        3000,
    ),
    ArtifactKind.solutions: (
        "Resolva PASSO A PASSO cada exercício do material abaixo, na ordem. Markdown: para cada "
        "um, '### Exercício N' (mantenha a numeração original), o enunciado resumido em uma linha, "
        "os passos numerados (um cálculo ou raciocínio por passo), e no fim '**Resposta:** …'. "
        "Se um enunciado estiver incompleto ou ilegível, diga o que falta em vez de inventar. "
        "Explique como um professor particular: curto, direto, sem pular etapas.\n\n",
        False,
        6000,
    ),
    ArtifactKind.mindmap: (
        "Monte um MAPA MENTAL do conteúdo necessário para esses exercícios. Responda SOMENTE com "
        'JSON válido no formato {"title": string, "children": [{"title": string, '
        '"note": string opcional curta, "children": [...]}]}. Raiz = o tema da prova; até 6 '
        "ramos principais (conceitos); cada ramo com até 5 sub-itens (fórmulas, regras, "
        "armadilhas, tipos de exercício). Profundidade máxima 3. Títulos com no máximo 6 "
        "palavras. Sem LaTeX.\n\n",
        True,
        2500,
    ),
    ArtifactKind.quiz: (
        "Crie um QUIZ de 8 questões de múltipla escolha que treinem exatamente as habilidades "
        "exigidas por esses exercícios (variando números e contextos, sem copiar). Responda "
        'SOMENTE com JSON válido: {"questions": [{"question": string, "options": [4 '
        'strings], "answer": índice 0–3 da correta, "explanation": string curta explicando '
        "a resposta}]}. Misture a posição da correta. Sem LaTeX.\n\n",
        True,
        3500,
    ),
}


def _validate_mindmap(data: Any) -> dict[str, Any]:
    def node(n: Any, depth: int) -> dict[str, Any]:
        if not isinstance(n, dict) or not str(n.get("title", "")).strip():
            raise ai.AIError("Mapa mental fora do formato esperado.")
        out: dict[str, Any] = {"title": str(n["title"]).strip()[:80]}
        if n.get("note"):
            out["note"] = str(n["note"]).strip()[:160]
        children = n.get("children") or []
        if depth < 3 and isinstance(children, list):
            out["children"] = [node(c, depth + 1) for c in children[:6]]
        else:
            out["children"] = []
        return out

    return node(data, 1)


def _validate_quiz(data: Any) -> dict[str, Any]:
    questions = data.get("questions") if isinstance(data, dict) else None
    if not isinstance(questions, list) or not questions:
        raise ai.AIError("Quiz fora do formato esperado.")
    out = []
    for q in questions[:12]:
        if not isinstance(q, dict):
            continue
        options = q.get("options")
        answer = q.get("answer")
        if (
            not isinstance(options, list)
            or len(options) < 2
            or not isinstance(answer, int)
            or not 0 <= answer < len(options)
        ):
            continue
        out.append(
            {
                "question": str(q.get("question", "")).strip()[:500],
                "options": [str(o).strip()[:200] for o in options[:5]],
                "answer": answer,
                "explanation": str(q.get("explanation", "")).strip()[:500],
            }
        )
    if not out:
        raise ai.AIError("Quiz fora do formato esperado.")
    return {"questions": out}


async def _ensure_artifact(
    db: AsyncSession, user_id: UUID, exam_id: UUID, kind: ArtifactKind
) -> StudyArtifact:
    existing = (await list_artifacts(db, exam_id)).get(kind)
    if existing is None:
        existing = StudyArtifact(user_id=user_id, exam_id=exam_id, kind=kind)
        db.add(existing)
    return existing


async def request_generation(
    db: AsyncSession, user_id: UUID, exam_id: UUID, kinds: list[ArtifactKind]
) -> list[ArtifactKind]:
    """Marca os tipos pedidos como `queued` (sem apagar o conteúdo antigo até terminar)."""
    if not ai.is_configured():
        raise ai.AINotConfiguredError("IA não configurada neste servidor.")
    e = await studies_service.get_exam(db, user_id, exam_id)
    if not await list_materials(db, e.id):
        raise ConflictError("Adicione pelo menos um material (fotos ou texto) antes de gerar.")
    queued: list[ArtifactKind] = []
    for kind in dict.fromkeys(kinds):
        a = await _ensure_artifact(db, user_id, e.id, kind)
        if a.status == ArtifactStatus.running:
            continue  # já está sendo gerado
        a.status = ArtifactStatus.queued
        a.error = None
        queued.append(kind)
    await db.flush()
    return queued


async def generate_one(db: AsyncSession, user_id: UUID, exam_id: UUID, kind: ArtifactKind) -> None:
    """Gera (ou regenera) um tipo. Grava `running` → `done`/`failed` com commits próprios."""
    e = await studies_service.get_exam(db, user_id, exam_id)
    materials = await list_materials(db, e.id)
    a = await _ensure_artifact(db, user_id, e.id, kind)
    a.status = ArtifactStatus.running
    a.error = None
    await db.commit()
    prompt, json_mode, max_tokens = PROMPTS[kind]
    try:
        text = await ai.chat(
            ai.ChatRequest(
                system=SYSTEM,
                user=prompt + _context(e, materials),
                json_mode=json_mode,
                max_tokens=max_tokens,
                temperature=0.3 if kind == ArtifactKind.quiz else 0.2,
            )
        )
        if kind == ArtifactKind.mindmap:
            a.content_json = _validate_mindmap(ai.parse_json(text))
            a.content_md = None
        elif kind == ArtifactKind.quiz:
            a.content_json = _validate_quiz(ai.parse_json(text))
            a.content_md = None
        else:
            a.content_md = text
            a.content_json = None
        a.status = ArtifactStatus.done
        a.model = get_settings().ai_model
        a.input_hash = materials_hash(materials)
    except ai.AppError as exc:
        a.status = ArtifactStatus.failed
        a.error = str(exc)[:300]
    except Exception:  # nunca deixa a tarefa morrer sem registrar
        log.exception("Falha inesperada ao gerar %s da prova %s", kind, exam_id)
        a.status = ArtifactStatus.failed
        a.error = "Falha inesperada ao gerar. Tente de novo."
    a.finished_at = now_utc()
    a.updated_at = now_utc()
    await db.commit()


async def run_generation(
    session_factory: Callable[[], AsyncSession],
    user_id: UUID,
    exam_id: UUID,
    kinds: list[ArtifactKind],
) -> None:
    """Corpo da tarefa em segundo plano: um tipo por vez, cada um com sua sessão."""
    for kind in kinds:
        async with session_factory() as db:
            try:
                await generate_one(db, user_id, exam_id, kind)
            except Exception:
                log.exception("Tarefa de IA abortada (%s, %s)", exam_id, kind)
                await db.rollback()
