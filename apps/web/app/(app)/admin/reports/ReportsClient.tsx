'use client'

import { useEffect, useState, useCallback } from 'react'
import { Download, ChevronDown, ChevronUp, BarChart3, Users, FolderOpen, TrendingUp } from 'lucide-react'
import { api } from '@/lib/api'

type DatePreset = 'thisWeek' | 'thisMonth' | 'lastMonth' | 'last3Months'

interface UserHourRow {
  userId: string; name: string; area: string | null; role: string
  totalHours: number; tasksCompleted: number; onTimePct: number | null
}

interface ProjectRow { projectId: string; projectName: string; totalHours: number }
interface ClientHourRow { clientId: string; clientName: string; totalHours: number; projects: ProjectRow[] }
interface WeekRow { weekStart: string; weekEnd: string; totalHours: number; tasksCompleted: number; avgHoursPerPerson: number }

function getDateRange(preset: DatePreset): { startDate: string; endDate: string } {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  if (preset === 'thisWeek') {
    const day = now.getDay()
    const mon = new Date(now); mon.setDate(mon.getDate() - (day === 0 ? 6 : day - 1)); mon.setHours(0,0,0,0)
    return { startDate: fmt(mon), endDate: fmt(now) }
  }
  if (preset === 'thisMonth') {
    return { startDate: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: fmt(now) }
  }
  if (preset === 'lastMonth') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last  = new Date(now.getFullYear(), now.getMonth(), 0)
    return { startDate: fmt(first), endDate: fmt(last) }
  }
  // last3Months
  const start3 = new Date(now); start3.setMonth(start3.getMonth() - 3)
  return { startDate: fmt(start3), endDate: fmt(now) }
}

const PRESET_LABELS: Record<DatePreset, string> = {
  thisWeek: 'Esta semana', thisMonth: 'Este mes', lastMonth: 'Mes anterior', last3Months: 'Últimos 3 meses',
}

function HoursBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-[#17394f] rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-700 w-10 text-right">{value}h</span>
    </div>
  )
}

export function ReportsClient() {
  const [preset, setPreset]         = useState<DatePreset>('thisMonth')
  const [userRows, setUserRows]     = useState<UserHourRow[]>([])
  const [clientRows, setClientRows] = useState<ClientHourRow[]>([])
  const [weekRows, setWeekRows]     = useState<WeekRow[]>([])
  const [loading, setLoading]       = useState(false)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  const { startDate, endDate } = getDateRange(preset)
  const qs = `?startDate=${startDate}&endDate=${endDate}`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [users, clients, weeks] = await Promise.all([
        api.get<UserHourRow[]>(`/api/reports/hours-by-user${qs}`),
        api.get<ClientHourRow[]>(`/api/reports/hours-by-project${qs}`),
        api.get<WeekRow[]>('/api/reports/weekly?weeks=8'),
      ])
      setUserRows(users)
      setClientRows(clients)
      setWeekRows(weeks)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [qs])

  useEffect(() => { load() }, [load])

  const maxHours = Math.max(1, ...userRows.map(r => r.totalHours))
  const maxWeekHours = Math.max(1, ...weekRows.map(r => r.totalHours))

  function handleExport() {
    window.open(`/api/reports/hours-by-user${qs}&format=csv`, '_blank')
  }

  function fmtWeek(iso: string) {
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-[#17394f]" />
              Reportes
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Horas registradas y productividad del equipo</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden text-sm">
              {(Object.keys(PRESET_LABELS) as DatePreset[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={`px-3 py-1.5 font-medium transition-colors ${preset === p ? 'bg-[#17394f] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  {PRESET_LABELS[p]}
                </button>
              ))}
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 border border-slate-200 bg-white text-slate-600 hover:text-slate-800 text-sm font-medium rounded-lg px-3 py-1.5 transition-colors"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <span className="animate-spin w-6 h-6 border-2 border-[#17394f] border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && (
          <div className="space-y-6">

            {/* Section 1 — Hours by person */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                <Users className="w-4 h-4 text-[#17394f]" />
                <h2 className="text-sm font-semibold text-slate-800">Horas por persona</h2>
              </div>
              {userRows.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Sin datos en este período</p>
              ) : (
                <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-50">
                      <th className="px-6 py-2.5 font-medium">Persona</th>
                      <th className="px-4 py-2.5 font-medium">Horas</th>
                      <th className="px-4 py-2.5 font-medium">Tareas</th>
                      <th className="px-4 py-2.5 font-medium">On-time</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {userRows.map(row => (
                      <>
                        <tr
                          key={row.userId}
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => setExpandedUser(expandedUser === row.userId ? null : row.userId)}
                        >
                          <td className="px-6 py-3">
                            <div className="font-medium text-slate-800">{row.name}</div>
                            <div className="text-xs text-slate-400">{row.area ?? row.role}</div>
                          </td>
                          <td className="px-4 py-3 min-w-[160px]">
                            <HoursBar value={row.totalHours} max={maxHours} />
                          </td>
                          <td className="px-4 py-3 text-slate-700 font-medium">{row.tasksCompleted}</td>
                          <td className="px-4 py-3">
                            {row.onTimePct !== null ? (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.onTimePct >= 80 ? 'bg-emerald-50 text-emerald-700' : row.onTimePct >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                                {row.onTimePct}%
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="pr-4 py-3 text-slate-400">
                            {expandedUser === row.userId ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </td>
                        </tr>
                        {expandedUser === row.userId && (
                          <tr key={`${row.userId}-exp`} className="bg-slate-50">
                            <td colSpan={5} className="px-6 py-3">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Desglose por proyecto</p>
                              <DesglosePorProyecto userId={row.userId} qs={qs} />
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table></div>
              )}
            </section>

            {/* Section 2 — Hours by project */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                <FolderOpen className="w-4 h-4 text-[#17394f]" />
                <h2 className="text-sm font-semibold text-slate-800">Horas por proyecto</h2>
              </div>
              {clientRows.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Sin datos en este período</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {clientRows.map(client => (
                    <div key={client.clientId}>
                      <div className="flex items-center justify-between px-6 py-3 bg-slate-50">
                        <span className="text-sm font-semibold text-slate-800">{client.clientName}</span>
                        <span className="text-xs font-bold text-[#17394f]">{client.totalHours}h total</span>
                      </div>
                      {client.projects.map(p => (
                        <div key={p.projectId} className="flex items-center justify-between px-8 py-2.5 hover:bg-slate-50 transition-colors">
                          <span className="text-sm text-slate-600">{p.projectName}</span>
                          <span className="text-xs font-medium text-slate-500">{p.totalHours}h</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Section 3 — Weekly productivity */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                <TrendingUp className="w-4 h-4 text-[#17394f]" />
                <h2 className="text-sm font-semibold text-slate-800">Productividad semanal (últimas 8 semanas)</h2>
              </div>
              {weekRows.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Sin datos</p>
              ) : (
                <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-50">
                      <th className="px-6 py-2.5 font-medium">Semana</th>
                      <th className="px-4 py-2.5 font-medium">Horas equipo</th>
                      <th className="px-4 py-2.5 font-medium">Tareas completadas</th>
                      <th className="px-4 py-2.5 font-medium">Avg h/persona</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {weekRows.map(w => (
                      <tr key={w.weekStart} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 text-slate-700 font-medium">{fmtWeek(w.weekStart)} – {fmtWeek(w.weekEnd)}</td>
                        <td className="px-4 py-3 min-w-[180px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#17394f] rounded-full" style={{ width: `${(w.totalHours / maxWeekHours) * 100}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-slate-700 w-10 text-right">{w.totalHours}h</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{w.tasksCompleted}</td>
                        <td className="px-4 py-3 text-slate-700">{w.avgHoursPerPerson}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </section>

          </div>
        )}
      </div>
    </div>
  )
}

function DesglosePorProyecto({ userId, qs }: { userId: string; qs: string }) {
  const [data, setData] = useState<{ projectName: string; clientName: string; totalHours: number }[] | null>(null)

  useEffect(() => {
    api.get<{ hoursByProject: { projectName: string; clientName: string; totalHours: number }[] }>(`/api/reports/user/${userId}${qs}`)
      .then(r => setData(r.hoursByProject))
      .catch(() => setData([]))
  }, [userId, qs])

  if (data === null) return <span className="text-xs text-slate-400">Cargando…</span>
  if (data.length === 0) return <span className="text-xs text-slate-400">Sin proyectos en este período</span>

  return (
    <div className="space-y-1">
      {data.map(p => (
        <div key={p.projectName} className="flex items-center justify-between text-xs">
          <span className="text-slate-600">{p.projectName} <span className="text-slate-400">· {p.clientName}</span></span>
          <span className="font-medium text-slate-700">{p.totalHours}h</span>
        </div>
      ))}
    </div>
  )
}
