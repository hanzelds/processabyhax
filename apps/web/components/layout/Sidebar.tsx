'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useSidebarStore } from '@/store/sidebarStore'
import { User } from '@/types'
import { SidebarTeamspaces } from './SidebarTeamspaces'
import {
  CheckSquare, FolderKanban, Users, Building2,
  Settings, LogOut, ChevronLeft, ChevronRight, CalendarDays, Clapperboard, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── ProcessaIcon ──────────────────────────────────────────────────────────────

function ProcessaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.9" />
      <rect x="8" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.9" />
      <rect x="1" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.9" />
      <rect x="8" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.4" />
    </svg>
  )
}

// ── Nav item ──────────────────────────────────────────────────────────────────

interface NavItemProps {
  href: string
  label: string
  icon: LucideIcon
  collapsed: boolean
  badge?: number
  badgeAlert?: boolean
}

function NavItem({ href, label, icon: Icon, collapsed, badge, badgeAlert }: NavItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        'flex items-center gap-3 mx-2 my-0.5 rounded-lg transition-all duration-150',
        collapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2',
        isActive
          ? 'text-[#17394f]'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      )}
      style={isActive ? { backgroundColor: 'rgba(23,57,79,0.08)' } : {}}
    >
      <Icon
        className={cn(
          'shrink-0 transition-colors',
          collapsed ? 'w-[18px] h-[18px]' : 'w-4 h-4',
          isActive ? 'text-[#17394f]' : 'text-gray-400'
        )}
      />
      {!collapsed && (
        <span className="text-sm font-medium truncate flex-1">{label}</span>
      )}
      {/* Badge: full when expanded */}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none shrink-0"
          style={{
            backgroundColor: badgeAlert ? 'rgba(239,68,68,0.1)' : 'rgba(23,57,79,0.1)',
            color:           badgeAlert ? '#ef4444' : '#17394f',
          }}
        >
          {badge}
        </span>
      )}
      {/* Active dot when expanded */}
      {!collapsed && isActive && badge === undefined && (
        <div
          className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: '#17394f', opacity: 0.4 }}
        />
      )}
      {/* Dot indicator for badge in collapsed mode */}
      {collapsed && badge !== undefined && badge > 0 && (
        <span
          className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: badgeAlert ? '#ef4444' : '#17394f' }}
        />
      )}
    </Link>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) {
    return <div className="mx-3 my-1.5 h-px bg-gray-100" />
  }
  return (
    <p className="px-4 py-1.5 text-gray-400 text-[10px] font-semibold uppercase tracking-widest">
      {label}
    </p>
  )
}

// ── Nav sections config ───────────────────────────────────────────────────────

function getNavSections(role: string) {
  const sections = [
    {
      title: 'Principal',
      items: [
        { href: '/dashboard', label: 'Mis tareas', icon: CheckSquare,   hasBadge: true },
        { href: '/projects',  label: 'Proyectos',  icon: FolderKanban,  hasBadge: false },
      ],
    },
    ...(role !== 'TEAM' ? [{
      title: 'Contenido',
      items: [
        { href: '/content/calendar', label: 'Calendario',    icon: CalendarDays,  hasBadge: false },
        { href: '/content/briefs',   label: 'Preproducción', icon: Clapperboard,  hasBadge: false },
      ],
    }] : []),
    ...(role !== 'TEAM' ? [{
      title: 'Clientes',
      items: [
        { href: '/clients',     label: 'Clientes', icon: Building2, hasBadge: false },
        { href: '/admin/users', label: 'Equipo',   icon: Users,     hasBadge: false },
      ],
    }] : []),
  ]
  return sections
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────

export function Sidebar({
  user, taskBadge, adminAlerts, collapsed,
}: {
  user: User
  taskBadge: number
  adminAlerts: number
  collapsed: boolean
}) {
  const router = useRouter()
  const { toggleCollapse, closeMobile, mobileOpen } = useSidebarStore()
  const pathname = usePathname()

  // Close mobile drawer on route change
  const prevPath = useRef(pathname)
  useEffect(() => {
    if (pathname !== prevPath.current) { closeMobile(); prevPath.current = pathname }
  }, [pathname, closeMobile])

  async function logout() {
    await api.post('/api/auth/logout', {})
    router.push('/login')
    router.refresh()
  }

  const initials = user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const sections = getNavSections(user.role)

  const sidebarInner = (
    <aside
      className={cn(
        'flex flex-col h-screen fixed left-0 top-0 z-40 transition-all duration-300 ease-in-out',
        'bg-white border-r border-gray-100',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* ── Logo ── */}
      <div
        className={cn(
          'flex items-center h-16 px-4 border-b border-gray-100 shrink-0',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#17394f' }}
            >
              <ProcessaIcon />
            </div>
            <div className="min-w-0">
              <p className="text-gray-800 font-semibold text-sm leading-tight truncate">Processa</p>
              <p className="text-gray-400 text-xs truncate">HAX ESTUDIO CREATIVO</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: '#17394f' }}
          >
            <ProcessaIcon />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={toggleCollapse}
            className="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-all shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3 sidebar-nav">
        {sections.map(section => (
          <div key={section.title} className="mb-1">
            <SectionLabel label={section.title} collapsed={collapsed} />
            {section.items.map(item => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                collapsed={collapsed}
                badge={item.hasBadge ? taskBadge : undefined}
                badgeAlert={item.hasBadge && taskBadge > 0}
              />
            ))}
          </div>
        ))}

        {/* Teamspaces */}
        <SidebarTeamspaces collapsed={collapsed} userRole={user.role} />

        {/* Admin */}
        {user.role === 'ADMIN' && (
          <div className="mb-1">
            <SectionLabel label="Admin" collapsed={collapsed} />
            <NavItem
              href="/admin/tasks"
              label="Tareas admin"
              icon={Settings}
              collapsed={collapsed}
              badge={adminAlerts}
              badgeAlert={adminAlerts > 0}
            />
          </div>
        )}
      </nav>

      {/* ── User footer ── */}
      <div className="shrink-0 border-t border-gray-100 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-white overflow-hidden"
              style={{ backgroundColor: '#17394f' }}
            >
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                : initials
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-700 text-sm font-medium truncate">{user.name}</p>
              <p className="text-gray-400 text-xs truncate">
                {user.role === 'ADMIN' ? 'Administrador' : user.role === 'LEAD' ? 'Lead' : 'Team'}
                {user.area ? ` · ${user.area}` : ''}
              </p>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-all shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white overflow-hidden"
              style={{ backgroundColor: '#17394f' }}
            >
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                : initials
              }
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Collapsed: floating expand button */}
      {collapsed && (
        <button
          onClick={toggleCollapse}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-700 transition-all z-50"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </aside>
  )

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block">{sidebarInner}</div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={closeMobile}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed top-0 left-0 h-screen z-50 transition-transform duration-200 ease-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ width: '280px' }}
      >
        {sidebarInner}
      </div>
    </>
  )
}

