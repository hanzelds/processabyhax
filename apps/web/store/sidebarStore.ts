'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarState {
  collapsed: boolean
  mobileOpen: boolean
  expandedTeamspaces: string[]
  toggleCollapse: () => void
  toggleTeamspace: (id: string) => void
  openMobile: () => void
  closeMobile: () => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      mobileOpen: false,
      expandedTeamspaces: [],
      toggleCollapse: () => set(s => ({ collapsed: !s.collapsed })),
      toggleTeamspace: (id) =>
        set(s => ({
          expandedTeamspaces: s.expandedTeamspaces.includes(id)
            ? s.expandedTeamspaces.filter(t => t !== id)
            : [...s.expandedTeamspaces, id],
        })),
      openMobile: () => set({ mobileOpen: true }),
      closeMobile: () => set({ mobileOpen: false }),
    }),
    {
      name: 'processa-sidebar',
      // Only persist collapse state and expanded teamspaces — not mobile open
      partialize: (state) => ({
        collapsed: state.collapsed,
        expandedTeamspaces: state.expandedTeamspaces,
      }),
    }
  )
)
