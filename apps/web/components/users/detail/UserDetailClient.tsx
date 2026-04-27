'use client'

import { useState } from 'react'
import Link from 'next/link'
import { User, Skill } from '@/types'
import { USER_ROLE_COLOR, USER_ROLE_LABEL, USER_STATUS_COLOR, USER_STATUS_LABEL } from '@/lib/utils'
import { UserTabs, UserTabId } from './UserTabs'
import { UserProfileTab } from './profile/UserProfileTab'
import { UserActivityTab } from './activity/UserActivityTab'
import { UserSecurityTab } from './security/UserSecurityTab'
import { UserPermissionsTab } from './permissions/UserPermissionsTab'
import { api } from '@/lib/api'

interface Props {
  user: User
  skills: Skill[]
  currentUserId: string
  isAdmin: boolean
}

export function UserDetailClient({ user: initialUser, skills, currentUserId, isAdmin }: Props) {
  const [user, setUser] = useState(initialUser)
  const [activeTab, setActiveTab] = useState<UserTabId>('profile')
  const isOwnProfile = currentUserId === user.id

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
        <Link href="/admin/users" className="hover:text-slate-600 transition-colors">Equipo</Link>
        <span>/</span>
        <span className="text-slate-700 font-medium truncate">{user.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.name} className="w-14 h-14 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
            <span className="text-brand-700 text-lg font-semibold">{initials}</span>
          </div>
        )}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-slate-900">{user.name}</h1>
            {isOwnProfile && <span className="text-sm text-slate-400">(tú)</span>}
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${USER_STATUS_COLOR[user.status]}`}>
              {USER_STATUS_LABEL[user.status]}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${USER_ROLE_COLOR[user.role]}`}>
              {USER_ROLE_LABEL[user.role]}
            </span>
          </div>
          {user.area && <p className="text-sm text-slate-500 mt-0.5">{user.area}</p>}
          {user.bio  && <p className="text-sm text-slate-400 mt-0.5 italic">{user.bio}</p>}
        </div>

        {/* Status actions — admin only, not own profile */}
        {isAdmin && !isOwnProfile && (
          <div className="ml-auto flex items-center gap-2">
            {user.status === 'ACTIVE' && (
              <SuspendButton userId={user.id} onUpdate={u => setUser(u)} />
            )}
            {user.status === 'SUSPENDED' && (
              <ReactivateButton userId={user.id} onUpdate={u => setUser(u)} />
            )}
            {(user.status === 'ACTIVE' || user.status === 'SUSPENDED') && (
              <DeactivateButton userId={user.id} onUpdate={u => setUser(u)} />
            )}
          </div>
        )}
      </div>

      <UserTabs activeTab={activeTab} onChange={setActiveTab} isAdmin={isAdmin} isOwnProfile={isOwnProfile} />

      {activeTab === 'profile' && (
        <UserProfileTab user={user} skills={skills} isAdmin={isAdmin} isOwnProfile={isOwnProfile} onUpdate={setUser} />
      )}
      {activeTab === 'activity' && <UserActivityTab userId={user.id} />}
      {activeTab === 'security' && (
        <UserSecurityTab userId={user.id} isAdmin={isAdmin} isOwnProfile={isOwnProfile} />
      )}
      {activeTab === 'permissions' && isAdmin && <UserPermissionsTab userId={user.id} />}
    </div>
  )
}

// Small action buttons
function SuspendButton({ userId, onUpdate }: { userId: string; onUpdate: (u: User) => void }) {
  return (
    <button onClick={async () => { const u = await api.patch<User>(`/api/users/${userId}/status`, { status: 'SUSPENDED' }); onUpdate(u) }}
      className="text-sm text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 px-3 py-1.5 rounded-lg transition-colors">
      Suspender
    </button>
  )
}

function ReactivateButton({ userId, onUpdate }: { userId: string; onUpdate: (u: User) => void }) {
  return (
    <button onClick={async () => { const u = await api.patch<User>(`/api/users/${userId}/status`, { status: 'ACTIVE' }); onUpdate(u) }}
      className="text-sm text-emerald-600 hover:text-emerald-800 border border-emerald-200 hover:border-emerald-400 px-3 py-1.5 rounded-lg transition-colors">
      Reactivar
    </button>
  )
}

function DeactivateButton({ userId, onUpdate }: { userId: string; onUpdate: (u: User) => void }) {
  async function handle() {
    if (!confirm('¿Dar de baja a este usuario? Esta acción revoca su acceso permanentemente.')) return
    const u = await api.patch<User>(`/api/users/${userId}/status`, { status: 'INACTIVE' })
    onUpdate(u)
  }
  return (
    <button onClick={handle}
      className="text-sm text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors">
      Dar de baja
    </button>
  )
}
