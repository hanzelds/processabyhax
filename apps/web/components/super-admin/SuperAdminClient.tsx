'use client'

import { useState, useEffect, Fragment } from 'react'
import { api } from '@/lib/api'
import {
  Building2, Users, TrendingUp, Activity,
  ChevronRight, X, Loader2, AlertTriangle, CheckCircle2,
  Calendar, DollarSign, HardDrive, UserCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

type OrgPlan = 'TRIAL' | 'STARTER' | 'GROWTH' | 'STUDIO' | 'ENTERPRISE'
type OrgPlanStatus = 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED'

interface OrgSummary {
  id: string
  name: string
  slug: string
  plan: OrgPlan
  planStatus: OrgPlanStatus
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  stripeCustomerId: string | null
  maxUsers: number
  maxClients: number
  storageGb: number
  createdAt: string
  _count: { members: number; clients: number }
}

interface OrgMember {
  userId: string
  role: string
  joinedAt: string
  user: { id: string; name: string; email: string; status: string }
}

interface OrgDetail extends OrgSummary {
  members: OrgMember[]
}

interface Stats {
  totalOrgs: number
  activeOrgs: number
  trialOrgs: number
  totalUsers: number
  mrrEstimate: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PLAN_LABEL: Record<OrgPlan, string> = {
  TRIAL: 'Trial', STARTER: 'Starter', GROWTH: 'Growth', STUDIO: 'Studio', ENTERPRISE: 'Enterprise',
}

const PLAN_COLOR: Record<OrgPlan, string> = {
  TRIAL:      'bg-amber-100 text-amber-700',
  STARTER:    'bg-blue-100 text-blue-700',
  GROWTH:     'bg-emerald-100 text-emerald-700',
  STUDIO:     'bg-violet-100 text-violet-700',
  ENTERPRISE: 'bg-slate-100 text-slate-700',
}

const STATUS_COLOR: Record<OrgPlanStatus, string> = {
  ACTIVE:    'bg-emerald-100 text-emerald-700',
  PAST_DUE:  'bg-orange-100 text-orange-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
}

const STATUS_LABEL: Record<OrgPlanStatus, string> = {
  ACTIVE: 'Activo', PAST_DUE: 'Vencido', SUSPENDED: 'Suspendido', CANCELLED: 'Cancelado',
}

const PLAN_OPTIONS: OrgPlan[] = ['TRIAL', 'STARTER', 'GROWTH', 'STUDIO', 'ENTERPRISE']
const STATUS_OPTIONS: OrgPlanStatus[] = ['ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED']

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-start gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Edit panel ────────────────────────────────────────────────────────────────

function OrgDetailPanel({
  org,
  onClose,
  onUpdated,
}: {
  org: OrgDetail
  onClose: () => void
  onUpdated: (org: OrgSummary) => void
}) {
  const [form, setForm] = useState({
    plan: org.plan,
    planStatus: org.planStatus,
    maxUsers: String(org.maxUsers),
    maxClients: String(org.maxClients),
    storageGb: String(org.storageGb),
    trialEndsAt: org.trialEndsAt ? org.trialEndsAt.split('T')[0] : '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true); setError(null); setSaved(false)
    try {
      const updated = await api.patch<OrgSummary>(`/api/super-admin/organizations/${org.id}`, {
        plan: form.plan,
        planStatus: form.planStatus,
        maxUsers: Number(form.maxUsers),
        maxClients: Number(form.maxClients),
        storageGb: Number(form.storageGb),
        trialEndsAt: form.trialEndsAt || null,
      })
      onUpdated(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const INPUT = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400'
  const LABEL = 'text-xs font-semibold text-slate-500 mb-1 block'
  const SELECT = INPUT + ' bg-white'

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <aside className="relative z-10 bg-white h-full w-full max-w-lg flex flex-col shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">{org.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">/{org.slug}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-5 space-y-5">
          {/* Counters */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{org._count.members}</p>
              <p className="text-xs text-slate-500">Miembros</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{org._count.clients}</p>
              <p className="text-xs text-slate-500">Clientes</p>
            </div>
          </div>

          {/* Plan & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Plan</label>
              <select
                value={form.plan}
                onChange={e => setForm(f => ({ ...f, plan: e.target.value as OrgPlan }))}
                className={SELECT}
              >
                {PLAN_OPTIONS.map(p => (
                  <option key={p} value={p}>{PLAN_LABEL[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Estado</label>
              <select
                value={form.planStatus}
                onChange={e => setForm(f => ({ ...f, planStatus: e.target.value as OrgPlanStatus }))}
                className={SELECT}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Limits */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Máx. usuarios</label>
              <input
                type="number" min={1} value={form.maxUsers}
                onChange={e => setForm(f => ({ ...f, maxUsers: e.target.value }))}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Máx. clientes</label>
              <input
                type="number" min={1} value={form.maxClients}
                onChange={e => setForm(f => ({ ...f, maxClients: e.target.value }))}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Storage (GB)</label>
              <input
                type="number" min={1} value={form.storageGb}
                onChange={e => setForm(f => ({ ...f, storageGb: e.target.value }))}
                className={INPUT}
              />
            </div>
          </div>

          {/* Trial ends at */}
          <div>
            <label className={LABEL}>Trial vence</label>
            <input
              type="date" value={form.trialEndsAt}
              onChange={e => setForm(f => ({ ...f, trialEndsAt: e.target.value }))}
              className={INPUT}
            />
          </div>

          {/* Stripe */}
          <div>
            <label className={LABEL}>Stripe Customer ID</label>
            <p className="text-sm text-slate-600 font-mono bg-slate-50 rounded-lg px-3 py-2 break-all">
              {org.stripeCustomerId || <span className="text-slate-400 italic">Sin cuenta Stripe</span>}
            </p>
          </div>

          {/* Dates */}
          <div className="text-xs text-slate-400 space-y-1">
            <p>Período actual hasta: <span className="text-slate-600">{fmt(org.currentPeriodEnd)}</span></p>
            <p>Creada: <span className="text-slate-600">{fmt(org.createdAt)}</span></p>
          </div>

          {/* Members */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-widest">Miembros</p>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {org.members.map(m => (
                <div key={m.userId} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                    {m.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{m.user.name}</p>
                    <p className="text-xs text-slate-400 truncate">{m.user.email}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 shrink-0">{m.role}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 p-4">
          <button
            onClick={save}
            disabled={saving}
            className={cn(
              'w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2',
              saved
                ? 'bg-emerald-500 text-white'
                : 'bg-violet-600 hover:bg-violet-700 text-white',
              saving && 'opacity-70 cursor-not-allowed'
            )}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saved && <CheckCircle2 className="w-4 h-4" />}
            {saving ? 'Guardando…' : saved ? '¡Guardado!' : 'Guardar cambios'}
          </button>
        </div>
      </aside>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function SuperAdminClient() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [orgs, setOrgs] = useState<OrgSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrg, setSelectedOrg] = useState<OrgDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState<OrgPlan | ''>('')
  const [filterStatus, setFilterStatus] = useState<OrgPlanStatus | ''>('')

  useEffect(() => {
    async function load() {
      try {
        const [s, o] = await Promise.all([
          api.get<Stats>('/api/super-admin/stats'),
          api.get<OrgSummary[]>('/api/super-admin/organizations'),
        ])
        setStats(s)
        setOrgs(o)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error al cargar datos')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function openDetail(id: string) {
    setLoadingDetail(id)
    try {
      const detail = await api.get<OrgDetail>(`/api/super-admin/organizations/${id}`)
      setSelectedOrg(detail)
    } catch { /* ignore */ }
    finally { setLoadingDetail(null) }
  }

  async function toggleSuspend(org: OrgSummary) {
    const action = org.planStatus === 'SUSPENDED' ? 'reactivate' : 'suspend'
    setActionLoading(org.id)
    try {
      const updated = await api.post<{ id: string; planStatus: OrgPlanStatus }>(
        `/api/super-admin/organizations/${org.id}/${action}`, {}
      )
      setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, planStatus: updated.planStatus } : o))
      if (selectedOrg?.id === org.id) {
        setSelectedOrg(prev => prev ? { ...prev, planStatus: updated.planStatus } : null)
      }
    } catch { /* ignore */ }
    finally { setActionLoading(null) }
  }

  function handleUpdated(updated: OrgSummary) {
    setOrgs(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o))
    setSelectedOrg(prev => prev ? { ...prev, ...updated } : null)
  }

  // Filtering
  const filtered = orgs.filter(o => {
    const q = search.toLowerCase()
    const matchSearch = !q || o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q)
    const matchPlan = !filterPlan || o.plan === filterPlan
    const matchStatus = !filterStatus || o.planStatus === filterStatus
    return matchSearch && matchPlan && matchStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Cargando…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-4">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        {error}
      </div>
    )
  }

  const SELECT_SM = 'border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 text-slate-700'

  return (
    <>
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
          <StatCard
            label="Total orgs" value={stats.totalOrgs}
            icon={Building2} color="bg-slate-100 text-slate-600"
          />
          <StatCard
            label="Activas" value={stats.activeOrgs}
            icon={Activity} color="bg-emerald-100 text-emerald-600"
          />
          <StatCard
            label="En trial" value={stats.trialOrgs}
            icon={Calendar} color="bg-amber-100 text-amber-600"
          />
          <StatCard
            label="Usuarios" value={stats.totalUsers}
            icon={Users} color="bg-blue-100 text-blue-600"
          />
          <StatCard
            label="MRR estimado" value={fmtMoney(stats.mrrEstimate)}
            icon={DollarSign} color="bg-violet-100 text-violet-600"
            sub="STARTER×49 + GROWTH×99 + STUDIO×199"
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-slate-100">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o slug…"
            className="flex-1 min-w-40 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
          />
          <select value={filterPlan} onChange={e => setFilterPlan(e.target.value as OrgPlan | '')} className={SELECT_SM}>
            <option value="">Todos los planes</option>
            {PLAN_OPTIONS.map(p => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as OrgPlanStatus | '')} className={SELECT_SM}>
            <option value="">Todos los estados</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <span className="text-xs text-slate-400 shrink-0">{filtered.length} orgs</span>
        </div>

        {/* Table — desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-4 py-2.5">Nombre</th>
                <th className="px-4 py-2.5">Plan</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5 text-right">Usuarios</th>
                <th className="px-4 py-2.5 text-right">Clientes</th>
                <th className="px-4 py-2.5">Trial / Período</th>
                <th className="px-4 py-2.5">Creada</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(org => (
                <tr key={org.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openDetail(org.id)}
                      className="flex items-center gap-1.5 text-slate-800 font-medium hover:text-violet-700 transition-colors text-left group"
                    >
                      {org.name}
                      {loadingDetail === org.id
                        ? <Loader2 className="w-3 h-3 animate-spin text-violet-500 shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-400 shrink-0" />
                      }
                    </button>
                    <p className="text-xs text-slate-400">/{org.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', PLAN_COLOR[org.plan])}>
                      {PLAN_LABEL[org.plan]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLOR[org.planStatus])}>
                      {STATUS_LABEL[org.planStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    <span className="flex items-center justify-end gap-1">
                      <UserCheck className="w-3 h-3 text-slate-300" />
                      {org._count.members}
                      <span className="text-slate-300">/{org.maxUsers}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    <span className="flex items-center justify-end gap-1">
                      <Building2 className="w-3 h-3 text-slate-300" />
                      {org._count.clients}
                      <span className="text-slate-300">/{org.maxClients}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {org.plan === 'TRIAL' ? fmt(org.trialEndsAt) : fmt(org.currentPeriodEnd)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                    {fmt(org.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleSuspend(org)}
                      disabled={actionLoading === org.id}
                      className={cn(
                        'text-xs font-semibold px-2.5 py-1 rounded-lg transition-all whitespace-nowrap',
                        org.planStatus === 'SUSPENDED'
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-red-50 text-red-600 hover:bg-red-100',
                        actionLoading === org.id && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {actionLoading === org.id
                        ? <Loader2 className="w-3 h-3 animate-spin inline" />
                        : org.planStatus === 'SUSPENDED' ? 'Reactivar' : 'Suspender'
                      }
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                    No se encontraron organizaciones
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cards — mobile */}
        <div className="md:hidden divide-y divide-slate-100">
          {filtered.map(org => (
            <div key={org.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <button
                    onClick={() => openDetail(org.id)}
                    className="font-semibold text-slate-800 hover:text-violet-700 text-left flex items-center gap-1"
                  >
                    {org.name}
                    {loadingDetail === org.id
                      ? <Loader2 className="w-3 h-3 animate-spin text-violet-500" />
                      : <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                    }
                  </button>
                  <p className="text-xs text-slate-400">/{org.slug}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', PLAN_COLOR[org.plan])}>
                    {PLAN_LABEL[org.plan]}
                  </span>
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLOR[org.planStatus])}>
                    {STATUS_LABEL[org.planStatus]}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-300" />
                  {org._count.members}/{org.maxUsers} usuarios
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-300" />
                  {org._count.clients}/{org.maxClients} clientes
                </span>
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5 text-slate-300" />
                  {org.storageGb}GB
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {org.plan === 'TRIAL' ? `Trial: ${fmt(org.trialEndsAt)}` : `Período: ${fmt(org.currentPeriodEnd)}`}
                </span>
                <button
                  onClick={() => toggleSuspend(org)}
                  disabled={actionLoading === org.id}
                  className={cn(
                    'text-xs font-semibold px-3 py-1.5 rounded-lg transition-all',
                    org.planStatus === 'SUSPENDED'
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-red-50 text-red-600 hover:bg-red-100',
                    actionLoading === org.id && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {actionLoading === org.id
                    ? <Loader2 className="w-3 h-3 animate-spin inline" />
                    : org.planStatus === 'SUSPENDED' ? 'Reactivar' : 'Suspender'
                  }
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-10">No se encontraron organizaciones</p>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedOrg && (
        <OrgDetailPanel
          org={selectedOrg}
          onClose={() => setSelectedOrg(null)}
          onUpdated={handleUpdated}
        />
      )}
    </>
  )
}
