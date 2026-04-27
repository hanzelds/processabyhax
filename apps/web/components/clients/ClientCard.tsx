import Link from 'next/link'
import { Client } from '@/types'
import { CLIENT_STATUS_LABEL, CLIENT_STATUS_COLOR, CLIENT_TIER_LABEL, CLIENT_TIER_COLOR } from '@/lib/utils'

function monthsSince(date: string): string {
  const months = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  if (months < 1) return 'Nuevo'
  if (months < 12) return `${months} mes${months !== 1 ? 'es' : ''}`
  const years = Math.floor(months / 12)
  return `${years} año${years !== 1 ? 's' : ''}`
}

export function ClientCard({ client }: { client: Client }) {
  const isInactive = client.status === 'INACTIVE'

  return (
    <Link
      href={`/clients/${client.id}`}
      className={`block bg-white rounded-xl border border-slate-200 px-5 py-4 hover:shadow-sm hover:border-slate-300 transition-all ${isInactive ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: name, industry, contact */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-semibold text-slate-900 truncate">{client.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${CLIENT_STATUS_COLOR[client.status]}`}>
              {CLIENT_STATUS_LABEL[client.status]}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${CLIENT_TIER_COLOR[client.tier]}`}>
              {CLIENT_TIER_LABEL[client.tier]}
            </span>
          </div>
          {client.industry && <p className="text-xs text-slate-400 mb-1">{client.industry}</p>}
          {client.primaryContact && (
            <p className="text-xs text-slate-500 truncate">
              {client.primaryContact.name}
              {client.primaryContact.role && <span className="text-slate-400"> · {client.primaryContact.role}</span>}
            </p>
          )}
          {/* Tags */}
          {(client.tags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {client.tags!.slice(0, 3).map(t => (
                <span key={t.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{t.name}</span>
              ))}
              {client.tags!.length > 3 && (
                <span className="text-xs text-slate-400">+{client.tags!.length - 3}</span>
              )}
            </div>
          )}
        </div>

        {/* Right: metrics */}
        <div className="text-right shrink-0 space-y-1.5">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {client.activeProjects ?? 0}
              <span className="text-slate-400 font-normal text-xs">/{client.totalProjects ?? 0}</span>
            </p>
            <p className="text-xs text-slate-400">proyectos activos</p>
          </div>
          {client.relationStart && (
            <p className="text-xs text-slate-400">Cliente: {monthsSince(client.relationStart)}</p>
          )}
        </div>
      </div>
    </Link>
  )
}
