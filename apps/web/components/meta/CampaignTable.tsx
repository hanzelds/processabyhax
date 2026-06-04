'use client'

import { useState } from 'react'
import { MetaCampaign } from '@/types'
import { api } from '@/lib/api'

interface Props {
  campaigns: MetaCampaign[]
  isAdmin: boolean
}

const OBJECTIVE_LABEL: Record<string, string> = {
  OUTCOME_TRAFFIC:     'Tráfico',
  OUTCOME_AWARENESS:   'Reconocimiento',
  OUTCOME_ENGAGEMENT:  'Interacción',
  OUTCOME_LEADS:       'Clientes potenciales',
  OUTCOME_SALES:       'Ventas',
  OUTCOME_APP_PROMOTION: 'App',
  LINK_CLICKS:         'Clics en enlace',
  REACH:               'Alcance',
  BRAND_AWARENESS:     'Reconocimiento de marca',
  VIDEO_VIEWS:         'Vistas de video',
  CONVERSIONS:         'Conversiones',
}

function fmtBudget(campaign: MetaCampaign) {
  const b = campaign.daily_budget || campaign.lifetime_budget
  if (!b) return '—'
  const num = parseFloat(b) / 100
  const type = campaign.daily_budget ? '/día' : 'total'
  return `$${num.toFixed(0)}${type}`
}

export function CampaignTable({ campaigns: initial, isAdmin }: Props) {
  const [campaigns, setCampaigns] = useState(initial)
  const [toggling, setToggling] = useState<string | null>(null)

  async function toggleStatus(c: MetaCampaign) {
    const next = c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    setToggling(c.id)
    try {
      await api.patch(`/api/meta/campaigns/${c.id}/status`, { status: next })
      setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, status: next } : x))
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setToggling(null)
    }
  }

  if (campaigns.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">No hay campañas en esta cuenta.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Campaña</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Objetivo</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Presupuesto</th>
            <th className="text-center py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {campaigns.map(c => (
            <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="py-3 px-4">
                <p className="font-medium text-slate-800 truncate max-w-xs">{c.name}</p>
                <p className="text-xs text-slate-400">{c.id}</p>
              </td>
              <td className="py-3 px-4 text-slate-600">
                {OBJECTIVE_LABEL[c.objective] || c.objective}
              </td>
              <td className="py-3 px-4 text-right text-slate-700 font-medium">
                {fmtBudget(c)}
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center justify-center">
                  {c.status === 'ARCHIVED' || c.status === 'DELETED' ? (
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                      {c.status === 'ARCHIVED' ? 'Archivada' : 'Eliminada'}
                    </span>
                  ) : isAdmin ? (
                    <button
                      onClick={() => toggleStatus(c)}
                      disabled={toggling === c.id}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                        c.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        c.status === 'ACTIVE' ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                    </button>
                  ) : (
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      c.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {c.status === 'ACTIVE' ? 'Activa' : 'Pausada'}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
