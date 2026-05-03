'use client'

import Link from 'next/link'
import { User } from '@/types'
import { USER_ROLE_LABEL, USER_ROLE_COLOR, USER_STATUS_LABEL, USER_STATUS_DOT } from '@/lib/utils'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

interface Props {
  user: User & { activeTasks?: number; overdueTasks?: number; activeSessions?: number; lastSeenRelative?: string | null }
  currentUserId: string
  isAdmin: boolean
  onStatusChange?: () => void
}

export function UserCard({ user: u, currentUserId, isAdmin, onStatusChange }: Props) {
  const router = useRouter()
  const toast  = useToast()

  async function changeStatus(status: string) {
    try {
      await api.patch(`/api/users/${u.id}/status`, { status })
      onStatusChange?.()
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  const initials = u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className={`bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center gap-4 hover:border-slate-300 transition-colors ${u.status === 'INACTIVE' ? 'opacity-50' : ''}`}>
      {/* Avatar */}
      <div className="relative shrink-0">
        {u.avatarUrl ? (
          <img src={u.avatarUrl} alt={u.name} className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
            <span className="text-brand-700 text-sm font-semibold">{initials}</span>
          </div>
        )}
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${USER_STATUS_DOT[u.status]}`} />
      </div>

      {/* Name + email */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link href={`/admin/users/${u.id}`} className="text-sm font-medium text-slate-900 hover:text-brand-700 truncate">
            {u.name}
          </Link>
          {u.id === currentUserId && <span className="text-xs text-slate-400">(tú)</span>}
        </div>
        <p className="text-xs text-slate-400 truncate">{u.email}</p>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 shrink-0">
        {u.area && (
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full hidden sm:inline-flex">{u.area}</span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${USER_ROLE_COLOR[u.role]}`}>
          {USER_ROLE_LABEL[u.role]}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          u.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
        }`}>
          {USER_STATUS_LABEL[u.status]}
        </span>
      </div>

      {/* Metrics */}
      <div className="text-right shrink-0 hidden md:block">
        <p className="text-sm font-medium text-slate-700">{u.activeTasks ?? 0}</p>
        <p className="text-xs text-slate-400">tareas activas</p>
      </div>

      {u.overdueTasks != null && u.overdueTasks > 0 && (
        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium shrink-0 hidden lg:inline-flex">
          {u.overdueTasks} atrasada{u.overdueTasks > 1 ? 's' : ''}
        </span>
      )}

      <div className="text-right shrink-0 hidden lg:block min-w-[90px]">
        <p className="text-xs text-slate-400">{u.lastSeenRelative ?? 'Nunca'}</p>
        {u.activeSessions != null && u.activeSessions > 0 && (
          <p className="text-xs text-slate-300">{u.activeSessions} sesión{u.activeSessions > 1 ? 'es' : ''}</p>
        )}
      </div>

      {/* Actions */}
      {isAdmin && u.id !== currentUserId && (
        <div className="shrink-0">
          {u.status === 'INVITED' && (
            <button
              onClick={async () => {
                try {
                  const res = await api.post<{ ok: boolean; invitationLink: string }>(`/api/users/${u.id}/resend-invitation`, {})
                  if (res.invitationLink) {
                    await navigator.clipboard.writeText(res.invitationLink).catch(() => {})
                    toast.success('Invitación reenviada — enlace copiado al portapapeles')
                  } else {
                    toast.success('Invitación reenviada por email')
                  }
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : 'Error al reenviar')
                }
              }}
              className="text-xs text-brand-600 hover:text-brand-800 font-medium"
            >
              Reenviar invitación
            </button>
          )}
          {u.status === 'ACTIVE' && (
            <button
              onClick={() => changeStatus('SUSPENDED')}
              className="text-xs text-amber-600 hover:text-amber-800 font-medium"
            >
              Suspender
            </button>
          )}
          {u.status === 'SUSPENDED' && (
            <button
              onClick={() => changeStatus('ACTIVE')}
              className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
            >
              Reactivar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
