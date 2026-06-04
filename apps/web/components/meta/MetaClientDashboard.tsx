'use client'

import { useState, useEffect, useCallback } from 'react'
import { MetaCampaign, MetaInsights, ClientMetaAccount, MetaPage } from '@/types'
import { api } from '@/lib/api'
import { MetricsCards } from './MetricsCards'
import { CampaignTable } from './CampaignTable'
import { DateRangePicker } from './DateRangePicker'
import { RefreshCw, Trash2, Users, Eye, TrendingUp } from 'lucide-react'

interface Props {
  clientId: string
  clientName: string
  clientColor?: string | null
  isAdmin: boolean
}

function getPreset30(): { since: string; until: string } {
  const until = new Date()
  const since = new Date()
  since.setDate(since.getDate() - 30)
  return { since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) }
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function fmtNum(n: string | number) {
  return parseInt(String(n) ?? '0').toLocaleString('es-DO')
}

export function MetaClientDashboard({ clientId, clientName, clientColor, isAdmin }: Props) {
  const [range, setRange]             = useState(getPreset30())
  const [linked, setLinked]           = useState<ClientMetaAccount[]>([])
  const [insights, setInsights]       = useState<MetaInsights[]>([])
  const [campaigns, setCampaigns]     = useState<MetaCampaign[]>([])
  const [pageData, setPageData]       = useState<{ page: MetaPage; insights: any[] } | null>(null)
  const [activeAcct, setActiveAcct]   = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [error, setError]             = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const accounts = await api.get<ClientMetaAccount[]>(`/api/meta/clients/${clientId}/linked`)
      setLinked(accounts)
      if (accounts.length > 0) {
        const acct = accounts.find(a => a.adAccountId === activeAcct) || accounts[0]
        setActiveAcct(acct.adAccountId)
        const [ins, camps] = await Promise.all([
          api.get<MetaInsights[]>(`/api/meta/accounts/${acct.adAccountId}/insights?since=${range.since}&until=${range.until}&level=campaign`),
          api.get<MetaCampaign[]>(`/api/meta/accounts/${acct.adAccountId}/campaigns`),
        ])
        setInsights(ins)
        setCampaigns(camps)

        if (acct.pageId) {
          const pg = await api.get<{ page: MetaPage; insights: any[] }>(`/api/meta/pages/${acct.pageId}/insights?since=${range.since}&until=${range.until}`)
          setPageData(pg)
        } else {
          setPageData(null)
        }
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [clientId, range, activeAcct])

  useEffect(() => { load() }, [range])

  async function handleRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  async function handleUnlink(id: string) {
    if (!confirm('¿Desvincular esta cuenta?')) return
    await api.delete(`/api/meta/clients/${clientId}/link/${id}`)
    load()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
      Cargando datos de Meta…
    </div>
  )

  if (linked.length === 0) return (
    <div className="text-center py-16 text-slate-400">
      <p className="text-sm">Este cliente no tiene cuentas de Meta vinculadas.</p>
    </div>
  )

  const currentAcct = linked.find(a => a.adAccountId === activeAcct) || linked[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ background: clientColor || '#6366f1' }}>
            {initials(clientName)}
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">{clientName}</h2>
            <p className="text-xs text-slate-400">{currentAcct.adAccountName}</p>
          </div>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors">
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          Sincronizar
        </button>
      </div>

      {/* Account tabs (si hay más de una) */}
      {linked.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {linked.map(a => (
            <button key={a.adAccountId}
              onClick={() => { setActiveAcct(a.adAccountId); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                a.adAccountId === activeAcct ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {a.adAccountName}
            </button>
          ))}
        </div>
      )}

      {/* Date range */}
      <DateRangePicker value={range} onChange={setRange} />

      {/* Error */}
      {error && <div className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</div>}

      {/* Metrics */}
      <MetricsCards insights={insights} />

      {/* Campaigns */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-medium text-slate-800 text-sm">Campañas</h3>
          <span className="text-xs text-slate-400">{campaigns.length} en total · {campaigns.filter(c => c.status === 'ACTIVE').length} activas</span>
        </div>
        <CampaignTable campaigns={campaigns} isAdmin={isAdmin} />
      </div>

      {/* Page insights */}
      {pageData && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-medium text-slate-800 text-sm mb-4">
            Página: {pageData.page.name}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{fmtNum(pageData.page.fan_count)}</p>
                <p className="text-xs text-slate-400">Seguidores</p>
              </div>
            </div>
            {pageData.insights.map((m: any) => {
              const value = m.values?.[m.values.length - 1]?.value ?? 0
              const labelMap: Record<string, { label: string; Icon: any; color: string }> = {
                page_impressions:       { label: 'Impresiones', Icon: Eye, color: 'text-violet-500' },
                page_engaged_users:     { label: 'Engagement',  Icon: TrendingUp, color: 'text-emerald-500' },
                page_reach:             { label: 'Alcance',     Icon: Eye, color: 'text-orange-500' },
                page_post_engagements:  { label: 'Interacciones', Icon: TrendingUp, color: 'text-pink-500' },
              }
              const meta = labelMap[m.name]
              if (!meta) return null
              return (
                <div key={m.name} className="flex items-center gap-3">
                  <div className={`w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center`}>
                    <meta.Icon className={`w-4 h-4 ${meta.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{fmtNum(value)}</p>
                    <p className="text-xs text-slate-400">{meta.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Linked accounts management */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-medium text-slate-800 text-sm mb-3">Cuentas vinculadas</h3>
          <div className="space-y-2">
            {linked.map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm text-slate-700 font-medium">{a.adAccountName}</p>
                  <p className="text-xs text-slate-400">{a.adAccountId}{a.pageName ? ` · ${a.pageName}` : ''}</p>
                </div>
                <button onClick={() => handleUnlink(a.id)}
                  className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
