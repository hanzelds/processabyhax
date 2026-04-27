'use client'

import { useState, useEffect } from 'react'
import { useSidebarStore } from '@/store/sidebarStore'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { BottomNav } from './BottomNav'
import { User } from '@/types'
import { cn } from '@/lib/utils'

interface AppShellProps {
  user: User
  taskBadge: number
  adminAlerts: number
  children: React.ReactNode
}

export function AppShell({ user, taskBadge, adminAlerts, children }: AppShellProps) {
  const { collapsed } = useSidebarStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isCollapsed = mounted && collapsed

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar — desktop only (fixed) */}
      <Sidebar
        user={user}
        taskBadge={taskBadge}
        adminAlerts={adminAlerts}
        collapsed={isCollapsed}
      />

      {/* Content wrapper — on mobile: full width; on desktop: offset by sidebar */}
      <div
        className={cn(
          'flex flex-col min-h-screen transition-[margin-left] duration-300 ease-in-out',
          isCollapsed ? 'lg:ml-16' : 'lg:ml-60'
        )}
      >
        {/* Topbar — fixed, offsets correctly on desktop only */}
        <Topbar user={user} sidebarCollapsed={isCollapsed} />

        {/* Main content — pb accounts for BottomNav + iOS safe area on mobile */}
        <main className="flex-1 mt-14 lg:mt-16 pb-24 lg:pb-6 safe-bottom">
          {children}
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <BottomNav role={user.role} />
    </div>
  )
}
