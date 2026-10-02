import { money, monthLabel } from '../lib/format'
import { useStore } from '../store/store'
import { BarChart } from './BarChart'

export function MonthlyBars({ data, height = 200 }: { data: { key: string; value: number }[]; height?: number }) {
  const { state } = useStore()
  const s = state.settings
  return (
    <BarChart
      ariaLabel="Spending per month"
      height={height}
      highlightLast
      data={data.map((d) => ({ ...d, label: monthLabel(d.key, s.locale), long: monthLabel(d.key, s.locale, 'long') }))}
      format={(v) => money(v, s)}
      formatAxis={(v) => money(v, s, { compact: true })}
    />
  )
}
