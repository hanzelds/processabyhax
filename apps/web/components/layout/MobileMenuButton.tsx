'use client'

import { Menu } from 'lucide-react'
import { useSidebarStore } from '@/store/sidebarStore'

export function MobileMenuButton() {
  const { openMobile } = useSidebarStore()
  return (
    <button
      onClick={openMobile}
      className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      aria-label="Abrir menú"
    >
      <Menu className="w-4 h-4" />
    </button>
  )
}
