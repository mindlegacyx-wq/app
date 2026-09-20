import { TopBar } from '@/app/shell/TopBar'
import { Card, EmptyState, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import type { Achievement } from '@/lib/types'

import { useAchievements } from './api'
import { Badge } from './Badge'
import { FAMILY, FAMILY_ORDER } from './shared'

/** Tela 43: a vitrine de selos, agrupada por família. */
export function AchievementsPage() {
  const { data, isPending, isError, error } = useAchievements()

  return (
    <>
      <TopBar title="Conquistas" />
      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-ink-faint" />
        </div>
      ) : isError ? (
        <EmptyState className="mt-6" title="Não foi possível carregar" description={errorMessage(error)} />
      ) : (
        <div className="mt-2 flex flex-col gap-5">
          <Card className="flex items-baseline justify-between p-4">
            <div>
              <p className="text-[12px] tracking-[0.14em] text-ink-faint uppercase">Conquistados</p>
              <p className="mt-0.5 text-[24px] leading-none font-semibold tabular-nums">
                {data.unlocked} <span className="text-[15px] font-normal text-ink-faint">de {data.total}</span>
              </p>
            </div>
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(data.unlocked / data.total) * 100}%` }} />
            </div>
          </Card>

          {FAMILY_ORDER.map((family) => {
            const items = data.items.filter((i: Achievement) => i.family === family)
            if (items.length === 0) return null
            return (
              <section key={family}>
                <h2 className="px-0.5 text-[12px] tracking-[0.14em] text-ink-faint uppercase">{FAMILY[family].label}</h2>
                <div className="mt-2 grid grid-cols-2 gap-2.5">
                  {items.map((item) => (
                    <Badge key={item.key} item={item} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
