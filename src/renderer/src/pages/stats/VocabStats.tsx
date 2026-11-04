import { Brain, GraduationCap, Languages, Repeat } from 'lucide-react'
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { Card } from '@/components/ui/card'
import { pct, plural } from '@/lib/utils'
import { statusOf } from '@shared/srs'
import type { VocabEntry, VocabReviewLog } from '@shared/types'

const DAY = 86_400_000

export function VocabStats({ entries, logs }: { entries: VocabEntry[]; logs: VocabReviewLog[] }) {
  const data = useMemo(() => {
    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const active = entries.filter((e) => !e.suspended)
    const started = active.filter((e) => e.srs.state !== 0)

    // Forecast: cards due on each of the next 14 days (overdue cards count for today).
    const forecast = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today.getTime() + i * DAY)
      return { label: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), date: d, count: 0 }
    })
    for (const e of started) {
      const idx = Math.floor((new Date(e.srs.due).getTime() - today.getTime()) / DAY)
      if (idx < 14) forecast[Math.max(0, idx)].count++
    }

    const from = new Date(now.getTime() - 30 * DAY).toISOString()
    const recent = logs.filter((l) => l.at >= from && l.prevState !== 0)
    return {
      total: entries.length,
      mastered: active.filter((e) => statusOf(e) === 'mastered').length,
      learning: started.length,
      dueToday: forecast[0].count,
      retention: recent.length ? pct(recent.filter((l) => l.grade > 1).length, recent.length) : null,
      reviews30: logs.filter((l) => l.at >= from).length,
      forecast
    }
  }, [entries, logs])

  if (!entries.length) return null

  return (
    <section>
      <h2 className="mb-3 text-[14px] font-semibold">Vocabulary</h2>
      <div className="grid grid-cols-4 gap-3">
        <Tile icon={Languages} label="Words saved" value={data.total} sub={`${data.learning} in study`} />
        <Tile icon={GraduationCap} label="Mastered" value={data.mastered} sub="remembered 3+ weeks" />
        <Tile icon={Repeat} label="Due today" value={data.dueToday} sub={`${plural(data.reviews30, 'review')} in 30 days`} />
        <Tile icon={Brain} label="Remembered" value={data.retention === null ? '—' : `${data.retention}%`} sub="of reviews, last 30 days" />
      </div>
      {data.learning > 0 && (
        <Card className="mt-3 p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-[14px] font-semibold">Upcoming reviews</h3>
            <span className="text-[12px] text-muted-foreground">next 14 days</span>
          </div>
          <div className="h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.forecast} margin={{ top: 4, right: 4, bottom: 0, left: -24 }} barCategoryGap={4}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={1} tick={{ className: 'fill-muted-foreground text-[11px]' }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ className: 'fill-muted-foreground text-[11px]' }} />
                <ChartTooltip
                  cursor={{ className: 'fill-muted/60' }}
                  content={({ active, payload }) => {
                    const d = payload?.[0]?.payload as (typeof data.forecast)[number] | undefined
                    if (!active || !d) return null
                    return (
                      <div className="rounded-lg border bg-popover px-3 py-2 text-[12px] shadow-md">
                        <div className="font-medium">{d.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                        <div className="text-muted-foreground">
                          <span className="font-semibold text-foreground">{d.count}</span> {d.count === 1 ? 'card' : 'cards'} due
                        </div>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} className="fill-primary" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </section>
  )
}

function Tile({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-tight">{value}</div>
      {sub && <div className="text-[11.5px] text-muted-foreground">{sub}</div>}
    </Card>
  )
}
