'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CheckSquare, FolderKanban, Building2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  href:  string
  label: string
  icon:  React.ElementType
}

function getItems(role: string): NavItem[] {
  return [
    { href: '/dashboard',   label: 'Tareas',    icon: CheckSquare  },
    { href: '/projects',    label: 'Proyectos', icon: FolderKanban },
    ...(role !== 'TEAM' ? [{ href: '/clients', label: 'Clientes', icon: Building2 }] : []),
    ...(role === 'ADMIN'  ? [{ href: '/admin/tasks', label: 'Admin', icon: Settings }] : []),
  ]
}

export function BottomNav({ role }: { role: string }) {
  const pathname = usePathname()
  const items    = getItems(role)

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 shadow-[0_-1px_0_0_rgba(0,0,0,0.04)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors',
                isActive ? 'text-[#17394f]' : 'text-gray-400 active:bg-gray-50'
              )}
            >
              <Icon
                className={cn('w-5 h-5', isActive ? 'text-[#17394f]' : 'text-gray-400')}
                strokeWidth={isActive ? 2.5 : 1.75}
              />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
