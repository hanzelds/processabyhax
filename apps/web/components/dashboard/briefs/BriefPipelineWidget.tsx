import Link from 'next/link'

interface Props {
  briefsByStatus: { status: string; count: number }[]
}

const STAGES: { key: string; label: string; color: string; dot: string }[] = [
  { key: 'idea',               label: 'Idea',             color: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400' },
  { key: 'en_desarrollo',      label: 'En desarrollo',    color: 'bg-blue-50 text-blue-700',        dot: 'bg-blue-400' },
  { key: 'revision_interna',   label: 'Rev. interna',     color: 'bg-violet-50 text-violet-700',   dot: 'bg-violet-400' },
  { key: 'aprobacion_cliente', label: 'Aprob. cliente',   color: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-400' },
  { key: 'aprobado',           label: 'Aprobado',         color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-400' },
  { key: 'en_produccion',      label: 'En producción',    color: 'bg-cyan-50 text-cyan-700',       dot: 'bg-cyan-500' },
  { key: 'en_edicion',         label: 'En edición',       color: 'bg-indigo-50 text-indigo-700',   dot: 'bg-indigo-400' },
]

export function BriefPipelineWidget({ briefsByStatus }: Props) {
  const byStatus = Object.fromEntries(briefsByStatus.map(b => [b.status, b.count]))
  const total = briefsByStatus.reduce((s, b) => s + b.count, 0)

  if (total === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-slate-900 text-sm">Pipeline de briefs</h2>
          <p className="text-xs text-slate-400">{total} brief{total !== 1 ? 's' : ''} en producción activa</p>
        </div>
        <Link href="/content/briefs" className="text-xs text-brand-600 hover:text-brand-800 font-medium transition-colors">
          Ver todos →
        </Link>
      </div>
      <div className="flex items-stretch gap-2 flex-wrap">
        {STAGES.map((stage, i) => {
          const count = byStatus[stage.key] ?? 0
          if (count === 0) return null
          return (
            <div key={stage.key} className="flex items-center gap-1.5 min-w-0">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${stage.color}`}>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${stage.dot}`} />
                <span className="whitespace-nowrap">{stage.label}</span>
                <span className="font-bold text-sm">{count}</span>
              </div>
              {i < STAGES.length - 1 && count > 0 && (
                <span className="text-slate-300 text-xs">›</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
