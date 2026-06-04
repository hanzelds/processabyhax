'use client'

import { MetaInsights } from '@/types'

interface Props {
  insights: MetaInsights[]
  currency?: string
}

function fmt(n: string | undefined, decimals = 0) {
  const num = parseFloat(n ?? '0')
  if (isNaN(num)) return '0'
  return num.toLocaleString('es-DO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtMoney(n: string | undefined, currency = 'USD') {
  const num = parseFloat(n ?? '0')
  if (isNaN(num)) return '$0.00'
  return num.toLocaleString('es-DO', { style: 'currency', currency, minimumFractionDigits: 2 })
}

export function MetricsCards({ insights, currency = 'USD' }: Props) {
  const totals = insights.reduce(
    (acc, row) => ({
      spend:       acc.spend + parseFloat(row.spend ?? '0'),
      impressions: acc.impressions + parseInt(row.impressions ?? '0'),
      clicks:      acc.clicks + parseInt(row.clicks ?? '0'),
      reach:       acc.reach + parseInt(row.reach ?? '0'),
    }),
    { spend: 0, impressions: 0, clicks: 0, reach: 0 }
  )
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0

  const cards = [
    { label: 'Gasto total',    value: fmtMoney(totals.spend.toString(), currency), sub: 'en el período', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Impresiones',    value: fmt(totals.impressions.toString()), sub: 'veces mostrado', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Clics',          value: fmt(totals.clicks.toString()), sub: `CTR ${ctr.toFixed(2)}%`, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Alcance',        value: fmt(totals.reach.toString()), sub: `CPM ${fmtMoney(cpm.toFixed(2), currency)}`, color: 'text-orange-600', bg: 'bg-orange-50' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">{c.label}</p>
          <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}
