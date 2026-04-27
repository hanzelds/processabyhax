'use client'

import { usePathname } from 'next/navigation'
import { ChevronRight, Menu } from 'lucide-react'
import { useSidebarStore } from '@/store/sidebarStore'
import { User } from '@/types'
import { cn } from '@/lib/utils'

const PAGE_LABELS: Record<string, { label: string; section?: string }> = {
  '/dashboard':    { label: 'Mis tareas',           section: 'Principal' },
  '/projects':     { label: 'Proyectos',             section: 'Principal' },
  '/clients':      { label: 'Clientes',              section: 'Clientes' },
  '/admin/users':  { label: 'Equipo',                section: 'Administración' },
  '/admin/tasks':  { label: 'Tareas administrativas',section: 'Administración' },
  '/profile':      { label: 'Mi perfil',             section: 'Cuenta' },
}

function getBreadcrumb(pathname: string) {
  // Check exact or prefix match
  const key = Object.keys(PAGE_LABELS)
    .sort((a, b) => b.length - a.length) // longest first
    .find(k => pathname === k || pathname.startsWith(k + '/'))
  return key ? PAGE_LABELS[key] : { label: 'Processa', section: undefined }
}

interface TopbarProps {
  user: User
  sidebarCollapsed: boolean
}

export function Topbar({ user, sidebarCollapsed }: TopbarProps) {
  const pathname = usePathname()
  const { openMobile } = useSidebarStore()
  const crumb = getBreadcrumb(pathname)

  const today = new Date().toLocaleDateString('es-DO', {
    weekday: 'short', day: 'numeric', month: 'short',
  })

  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-14 lg:h-16 bg-white border-b border-gray-100 flex items-center',
        'left-0 transition-[left] duration-300 ease-in-out',
        sidebarCollapsed ? 'lg:left-16' : 'lg:left-60'
      )}
    >
      <div className="flex items-center w-full px-6 gap-4">

        {/* Mobile hamburger */}
        <button
          onClick={openMobile}
          className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {crumb.section && (
            <>
              <span className="text-gray-300 text-sm hidden sm:block truncate">
                {crumb.section}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-200 hidden sm:block shrink-0" />
            </>
          )}
          <h1 className="text-gray-700 font-semibold text-sm leading-tight truncate">
            {crumb.label}
          </h1>
        </div>

        {/* Date */}
        <span className="hidden lg:block text-xs text-gray-300 shrink-0 capitalize">
          {today}
        </span>

        {/* User */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-gray-100 shrink-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 overflow-hidden"
            style={{ backgroundColor: '#17394f' }}
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="hidden lg:block min-w-0">
            <p className="text-gray-700 text-sm font-medium leading-tight truncate max-w-[120px]">
              {user.name.split(' ')[0]}
            </p>
            <p className="text-gray-400 text-xs truncate">
              {user.role === 'ADMIN' ? 'Admin' : user.role === 'LEAD' ? 'Lead' : 'Team'}
              {user.area ? ` · ${user.area}` : ''}
            </p>
          </div>
        </div>

      </div>
    </header>
  )
}
