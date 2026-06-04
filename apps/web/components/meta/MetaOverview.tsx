'use client'

import { useState, useEffect } from 'react'
import { ClientMetaAccount, Client } from '@/types'
import { api } from '@/lib/api'
import { DateRangePicker } from './DateRangePicker'
import { LinkAccountModal } from './LinkAccountModal'
import { useRouter } from 'next/navigation'
import { Plus, TrendingUp, ArrowRight } from 'lucide-react'

interface Props {
  clients: Pick<Client, 'id' | 'name' | 'color'>[]
  isAdmin: boolean
}

function getPreset30() {
  const until = new Date()
  const since = new Date()
  since.setDate(since.getDate() - 30)
  return { since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) }
}

function fmt(n: string | undefined) {
  return parseInt(n ?? '0').toLocaleString('es-DO')
}
function fmtMoney(n: string | undefined) {
  const num = parseFloat(n ?? '0')
  return isNaN(num) ? '$0' : `$${num.toFixed(0)}`
}
function fmtCtr(n: string | undefined) {
  const num = parseFloat(n ?? '0')
  return isNaN(num) ? '0%' : `${num.toFixed(2)}%`
}
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export function MetaOverview({ clients, isAdmin }: Props) {
  const router = useRouter()
  const [range, setRange]       = useState(getPreset30())
  const [overview, setOverview] = useState<ClientMetaAccount[]>([])
  const [loading, setLoading]   = useState(true)
  const [showLink, setShowLink] = useState(false)
  const [error, setError]       = useState('')

  async function loadOverview(r = range) {
    setLoading(true); setError('')
    try {
      const data = await api.get<ClientMetaAccount[]>(`/api/meta/overview?since=${r.since}&until=${r.until}`)
      setOverview(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOverview(range) }, [range])

  const totalSpend = overview.reduce((s, a) => s + parseFloat(a.metrics?.spend ?? '0'), 0)
  const totalClicks = overview.reduce((s, a) => s + parseInt(a.metrics?.clicks ?? '0'), 0)
  const totalImpressions = overview.reduce((s, a) => s + parseInt(a.metrics?.impressions ?? '0'), 0)
  const activeCampaigns = overview.reduce((s, a) => s + (a.metrics?.activeCampaigns ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Meta Ads</h1>
          <p className="text-sm text-slate-400 mt-0.5">Rendimiento de campañas por cliente</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowLink(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors">
            <Plus className="w-4 h-4" />
            Vincular cuenta
          </button>
        )}
      </div>

      {/* Date range */}
      <DateRangePicker value={range} onChange={setRange} />

      {/* Aggregate KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Gasto total',     value: `$${totalSpend.toFixed(0)}`,    sub: 'USD' },
          { label: 'Impresiones',     value: fmt(totalImpressions.toString()), sub: 'total' },
          { label: 'Clics',           value: fmt(totalClicks.toString()),     sub: 'total' },
          { label: 'Campañas activas',value: activeCampaigns.toString(),      sub: 'en este momento' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">{k.label}</p>
            <p className="text-2xl font-bold text-slate-900">{k.value}</p>
            <p className="text-xs text-slate-400">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && <div className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</div>}

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-sm text-slate-400">
          Cargando métricas…
        </div>
      ) : overview.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center">
          <TrendingUp className="w-8 h-8 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">No hay cuentas vinculadas</p>
          {isAdmin && (
            <button onClick={() => setShowLink(true)} className="mt-3 text-sm text-indigo-600 hover:underline">
              Vincular primera cuenta →
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wide">Cliente</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Cuenta</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Gasto</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Impresiones</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Clics</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">CTR</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Activas</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {overview.map(acct => {
                const clientColor = acct.client?.color
                const clientName  = acct.client?.name || 'Cliente'
                const clientId    = acct.client?.id || acct.clientId
                return (
                  <tr key={acct.id}
                    onClick={() => router.push(`/meta/${clientId}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: clientColor || '#6366f1' }}>
                          {initials(clientName)}
                        </div>
                        <span className="font-medium text-slate-800">{clientName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-xs">{acct.adAccountName}</td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-800">
                      {acct.metrics ? fmtMoney(acct.metrics.spend) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-600">
                      {acct.metrics ? fmt(acct.metrics.impressions) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-600">
                      {acct.metrics ? fmt(acct.metrics.clicks) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-600">
                      {acct.metrics ? fmtCtr(acct.metrics.ctr) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {acct.metrics !== null && acct.metrics !== undefined ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          acct.metrics.activeCampaigns > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {acct.metrics.activeCampaigns}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showLink && (
        <LinkAccountModal clients={clients} onClose={() => setShowLink(false)} onLinked={() => loadOverview(range)} />
      )}
    </div>
  )
}
