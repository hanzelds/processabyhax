'use client'

import { LayoutGrid, List, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ViewMode = 'kanban' | 'list' | 'calendar'

const VIEWS: { id: ViewMode; label: string; Icon: typeof LayoutGrid }[] = [
  { id: 'kanban',    label: 'Kanban',     Icon: LayoutGrid   },
  { id: 'list',      label: 'Lista',      Icon: List          },
  { id: 'calendar',  label: 'Calendario', Icon: CalendarDays  },
]

interface Props {
  view: ViewMode
  onChange: (v: ViewMode) => void
  noDateCount: number
  onNoDateClick: () => void
}

export function ViewToggle({ view, onChange, noDateCount, onNoDateClick }: Props) {
  return (
    <div className="flex items-center justify-between mb-5">
      {/* View buttons */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
        {VIEWS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              view === id
                ? 'bg-[#17394f] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Sin fecha badge — solo visible en calendar */}
      {view === 'calendar' && noDateCount > 0 && (
        <button
          onClick={onNoDateClick}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Sin fecha
          <span className="ml-0.5 bg-slate-200 text-slate-600 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
            {noDateCount}
          </span>
        </button>
      )}
    </div>
  )
}
