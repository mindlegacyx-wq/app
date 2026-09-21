/**
 * Contas do quadro de áreas feitas no próprio aparelho.
 *
 * Servem para a tela mudar no instante do toque: a matéria entra na área e a média da área
 * já se refaz, sem esperar o servidor (no plano grátis, ele pode levar segundos para acordar).
 * Quando a resposta chega, o resumo verdadeiro substitui este — as regras aqui são as mesmas
 * do backend (`grades/service.py`), então na prática nada pisca.
 */
import type { AreaGrades, GradesSummary } from '@/lib/types'

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100

/** Média da área por período = média das matérias que já têm nota; média do ano = média dos períodos. */
function recompute(s: GradesSummary): GradesSummary {
  const byId = new Map(s.subjects.map((x) => [x.subject_id, x]))
  const areas = s.areas.map((a): AreaGrades => {
    const subs = a.subject_ids.map((id) => byId.get(id)).filter((x) => x !== undefined)
    const done: number[] = []
    const periods = Array.from({ length: s.periods_per_year }, (_, i) => {
      const period = i + 1
      const values = subs
        .map((x) => x.periods.find((p) => p.period === period)?.average ?? null)
        .filter((v): v is number => v !== null)
      const average = values.length ? round2(values.reduce((t, v) => t + v, 0) / values.length) : null
      if (average !== null) done.push(average)
      return { period, average, with_grade: values.length, total: subs.length }
    })
    return {
      ...a,
      periods,
      year_average: done.length ? round2(done.reduce((t, v) => t + v, 0) / done.length) : null,
    }
  })
  return { ...s, areas }
}

/** Ordem da lista de matérias: área por área, na ordem da tela, e as soltas no fim. */
function sortSubjects(s: GradesSummary): GradesSummary {
  const byId = new Map(s.subjects.map((x) => [x.subject_id, x]))
  const ordered = s.areas.flatMap((a) => a.subject_ids.map((id) => byId.get(id)).filter((x) => x !== undefined))
  const loose = s.subjects.filter((x) => !x.area_id)
  return { ...s, subjects: [...ordered, ...loose] }
}

/** A área passa a ter exatamente estas matérias, nesta ordem (quem saiu fica sem área). */
export function withSubjectsInArea(s: GradesSummary, areaId: string, subjectIds: string[]): GradesSummary {
  const chosen = new Set(subjectIds)
  const subjects = s.subjects.map((x) =>
    chosen.has(x.subject_id)
      ? { ...x, area_id: areaId }
      : x.area_id === areaId
        ? { ...x, area_id: null }
        : x,
  )
  const areas = s.areas.map((a) =>
    a.id === areaId ? { ...a, subject_ids: [...subjectIds] } : { ...a, subject_ids: a.subject_ids.filter((id) => !chosen.has(id)) },
  )
  return recompute(sortSubjects({ ...s, subjects, areas }))
}

/** Uma matéria muda de área (ou sai de todas) e vai para o fim da nova. */
export function withSubjectArea(s: GradesSummary, subjectId: string, areaId: string | null): GradesSummary {
  const subjects = s.subjects.map((x) => (x.subject_id === subjectId ? { ...x, area_id: areaId } : x))
  const areas = s.areas.map((a) => {
    const rest = a.subject_ids.filter((id) => id !== subjectId)
    return { ...a, subject_ids: a.id === areaId ? [...rest, subjectId] : rest }
  })
  return recompute(sortSubjects({ ...s, subjects, areas }))
}

export function withAreaOrder(s: GradesSummary, areaIds: string[]): GradesSummary {
  const byId = new Map(s.areas.map((a) => [a.id, a]))
  const areas = areaIds.flatMap((id, i) => {
    const a = byId.get(id)
    return a ? [{ ...a, sort_order: i }] : []
  })
  return sortSubjects({ ...s, areas })
}

export function withEntryMode(s: GradesSummary, subjectId: string, mode: 'final' | 'items'): GradesSummary {
  return { ...s, subjects: s.subjects.map((x) => (x.subject_id === subjectId ? { ...x, entry_mode: mode } : x)) }
}

/** O cache de notas guarda resumos e também a lista simples de áreas; só os resumos mudam aqui. */
export function isSummary(d: unknown): d is GradesSummary {
  return typeof d === 'object' && d !== null && 'subjects' in d && 'areas' in d
}
