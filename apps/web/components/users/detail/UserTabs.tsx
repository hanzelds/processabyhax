'use client'

export type UserTabId = 'profile' | 'activity' | 'security' | 'permissions'

interface Props {
  activeTab: UserTabId
  onChange: (tab: UserTabId) => void
  isAdmin: boolean
  isOwnProfile: boolean
}

const TABS: { id: UserTabId; label: string; adminOnly?: boolean }[] = [
  { id: 'profile',     label: 'Perfil' },
  { id: 'activity',   label: 'Actividad' },
  { id: 'security',   label: 'Seguridad' },
  { id: 'permissions', label: 'Permisos', adminOnly: true },
]

export function UserTabs({ activeTab, onChange, isAdmin, isOwnProfile }: Props) {
  const visible = TABS.filter(t => {
    if (t.adminOnly && !isAdmin) return false
    if (t.id === 'security' && !isAdmin && !isOwnProfile) return false
    return true
  })

  return (
    <div className="flex gap-1 border-b border-slate-200 mb-6">
      {visible.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === tab.id
              ? 'border-brand-700 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
