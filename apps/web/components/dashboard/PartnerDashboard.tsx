'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Client, Shoot, ContentPiece, Task, User } from '@/types'
import {
  Building2, Film, CalendarDays, CheckSquare,
  ChevronRight, Loader2, Clock, MapPin, ExternalLink,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })
}

function formatShootDate(d: string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const STATUS_CONTENT: Record<string, { label: string; color: string }> = {
  listo:       { label: 'Listo',       color: 'bg-emerald-50 text-emerald-700' },
  programado:  { label: 'Programado',  color: 'bg-blue-50 text-blue-700' },
  publicado:   { label: 'Publicado',   color: 'bg-slate-100 text-slate-500' },
  en_revision: { label: 'En revisión', color: 'bg-amber-50 text-amber-700' },
  en_edicion:  { label: 'En edición',  color: 'bg-violet-50 text-violet-700' },
  pausado:     { label: 'Pausado',     color: 'bg-slate-50 text-slate-400' },
}

const STATUS_SHOOT: Record<string, { label: string; color: string }> = {
  DRAFT:       { label: 'Borrador',     color: 'bg-slate-100 text-slate-500' },
  CONFIRMED:   { label: 'Confirmado',   color: 'bg-blue-50 text-blue-700' },
  IN_PROGRESS: { label: 'En curso',     color: 'bg-amber-50 text-amber-700' },
  COMPLETED:   { label: 'Completado',   color: 'bg-emerald-50 text-emerald-700' },
  CANCELLED:   { label: 'Cancelado',    color: 'bg-red-50 text-red-500' },
}

const TASK_STATUS: Record<string, string> = {
  PENDING:     'Pendiente',
  IN_PROGRESS: 'En progreso',
  IN_REVIEW:   'En revisión',
  COMPLETED:   'Completada',
  BLOCKED:     'Bloqueada',
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, icon: Icon, count, link, linkLabel, children }: {
  title: string
  icon: React.ElementType
  count?: number
  link?: string
  linkLabel?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#17394f]" />
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {count !== undefined && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{count}</span>
          )}
        </div>
        {link && (
          <Link href={link} className="flex items-center gap-1 text-xs text-[#17394f] hover:underline font-medium">
            {linkLabel ?? 'Ver todos'} <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-slate-400 text-center py-4">{label}</p>
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  user: User
}

interface StandaloneTasksResponse {
  overdue: Task[]
  today: Task[]
  pending: Task[]
}

export function PartnerDashboard({ user }: Props) {
  const [clients,  setClients]  = useState<Client[]>([])
  const [shoots,   setShoots]   = useState<Shoot[]>([])
  const [pieces,   setPieces]   = useState<ContentPiece[]>([])
  const [tasks,    setTasks]    = useState<Task[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const today = new Date()
    const from  = today.toISOString().slice(0, 10)
    const to    = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10)
    const year  = today.getFullYear()
    const month = today.getMonth() + 1

    Promise.all([
      api.get<Client[]>('/api/clients'),
      api.get<Shoot[]>(`/api/shoots?from=${from}&to=${to}`),
      api.get<ContentPiece[]>(`/api/content/calendar?year=${year}&month=${month}`),
      api.get<StandaloneTasksResponse>('/api/tasks/standalone').catch(() => ({ overdue: [], today: [], pending: [], completed: [], members: [], viewUserId: '' })),
    ]).then(([c, s, p, t]) => {
      setClients(c ?? [])
      setShoots((s ?? []).slice(0, 5))
      // Only show upcoming/scheduled pieces
      setPieces((p ?? []).filter(x => ['programado', 'listo', 'en_revision', 'en_edicion'].includes(x.status)).slice(0, 6))
      const allTasks = [...(t.overdue ?? []), ...(t.today ?? []), ...(t.pending ?? [])]
      setTasks(allTasks.slice(0, 5))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const firstName = user.name.split(' ')[0]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#17394f]" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-semibold text-slate-900">
          Hola, {firstName} 👋
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Resumen del partnership — {clients.length} cliente{clients.length !== 1 ? 's' : ''} activo{clients.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Columna izquierda (2/3) ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Clientes */}
          <Section title="Mis clientes" icon={Building2} count={clients.length} link="/clients" linkLabel="Ver todos">
            {clients.length === 0 ? <EmptyState label="Sin clientes asignados" /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {clients.map(c => (
                  <Link
                    key={c.id}
                    href={`/clients/${c.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-[#17394f]/30 hover:bg-slate-50 transition-all group"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: c.color ?? '#17394f' }}
                    >
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate group-hover:text-[#17394f]">{c.name}</p>
                      <p className="text-xs text-slate-400 truncate">{c.industry ?? 'Cliente'}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#17394f] shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* Próximos rodajes */}
          <Section title="Próximos rodajes" icon={Film} count={shoots.length} link="/logistica/rodajes" linkLabel="Ver todos">
            {shoots.length === 0 ? <EmptyState label="Sin rodajes en los próximos 30 días" /> : (
              <div className="space-y-3">
                {shoots.map(s => {
                  const st = STATUS_SHOOT[s.status] ?? { label: s.status, color: 'bg-slate-100 text-slate-500' }
                  return (
                    <Link
                      key={s.id}
                      href={`/logistica/rodajes/${s.id}`}
                      className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-100 hover:border-[#17394f]/30 hover:bg-slate-50 transition-all group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate group-hover:text-[#17394f]">{s.title}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {s.shootDate && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Clock className="w-3 h-3" />{formatShootDate(s.shootDate)}
                            </span>
                          )}
                          {s.location && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <MapPin className="w-3 h-3" />{s.location.name}
                            </span>
                          )}
                        </div>
                        {s.client && <p className="text-xs text-slate-400 mt-0.5">{s.client.name}</p>}
                      </div>
                      <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </Section>

          {/* Contenido próximo */}
          <Section title="Contenido este mes" icon={CalendarDays} count={pieces.length} link="/content/calendar" linkLabel="Ver calendario">
            {pieces.length === 0 ? <EmptyState label="Sin contenido programado este mes" /> : (
              <div className="space-y-2">
                {pieces.map(p => {
                  const st = STATUS_CONTENT[p.status] ?? { label: p.status, color: 'bg-slate-100 text-slate-500' }
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.client?.color ?? '#17394f' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate font-medium">{p.title}</p>
                        <p className="text-xs text-slate-400">{p.client?.name} · {formatDate(p.scheduledDate)}</p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        </div>

        {/* ── Columna derecha (1/3) ── */}
        <div className="space-y-5">

          {/* Mis tareas */}
          <Section title="Mis tareas" icon={CheckSquare} count={tasks.length} link="/tasks" linkLabel="Ver todas">
            {tasks.length === 0 ? <EmptyState label="Sin tareas asignadas" /> : (
              <div className="space-y-2">
                {tasks.map(t => (
                  <div key={t.id} className="p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <span className="text-xs text-slate-400">
                        {TASK_STATUS[t.status] ?? t.status}
                      </span>
                      {t.dueDate && (
                        <span className="text-xs text-slate-400">{formatDate(t.dueDate)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Quick links */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Accesos rápidos</h2>
            <div className="space-y-1.5">
              {[
                { href: '/clients',           icon: Building2,   label: 'Clientes' },
                { href: '/projects',          icon: ExternalLink, label: 'Proyectos' },
                { href: '/logistica/rodajes', icon: Film,         label: 'Rodajes' },
                { href: '/content/calendar',  icon: CalendarDays, label: 'Calendario' },
              ].map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-600 hover:text-[#17394f] hover:bg-slate-50 transition-colors text-sm"
                >
                  <Icon className="w-4 h-4 text-slate-400" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
