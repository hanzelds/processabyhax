'use client'

interface Range { since: string; until: string }

interface Props {
  value: Range
  onChange: (r: Range) => void
}

function preset(days: number): Range {
  const until = new Date()
  const since = new Date()
  since.setDate(since.getDate() - days)
  return { since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) }
}

function thisMonth(): Range {
  const now = new Date()
  const since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const until = now.toISOString().slice(0, 10)
  return { since, until }
}

const PRESETS = [
  { label: 'Últimos 7d',  value: () => preset(7) },
  { label: 'Últimos 14d', value: () => preset(14) },
  { label: 'Últimos 30d', value: () => preset(30) },
  { label: 'Este mes',    value: thisMonth },
]

export function DateRangePicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map(p => {
        const r = p.value()
        const active = r.since === value.since && r.until === value.until
        return (
          <button
            key={p.label}
            onClick={() => onChange(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              active ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p.label}
          </button>
        )
      })}
      <div className="flex items-center gap-1.5 ml-2">
        <input
          type="date"
          value={value.since}
          onChange={e => onChange({ ...value, since: e.target.value })}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300"
        />
        <span className="text-slate-400 text-xs">→</span>
        <input
          type="date"
          value={value.until}
          onChange={e => onChange({ ...value, until: e.target.value })}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300"
        />
      </div>
    </div>
  )
}
