'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Clapperboard, Package, MapPin, Truck } from 'lucide-react'

const TABS = [
  { href: '/logistica/rodajes',   label: 'Rodajes',   icon: Clapperboard },
  { href: '/logistica/equipos',   label: 'Equipo',    icon: Package },
  { href: '/logistica/locaciones',label: 'Locaciones',icon: MapPin },
  { href: '/logistica/vehiculos', label: 'Vehículos', icon: Truck },
]

export function LogisticaTabs() {
  const pathname = usePathname()
  return (
    <div className="flex items-center gap-0.5 border-b border-slate-100 px-3 sm:px-6 bg-white overflow-x-auto">
      {TABS.map(tab => {
        const Icon = tab.icon
        const active = pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              active
                ? 'border-[#17394f] text-[#17394f]'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline sm:inline">{tab.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
