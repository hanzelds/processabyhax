'use client'

import { useState } from 'react'

export type TabId = 'summary' | 'kanban' | 'files' | 'history'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'summary',  label: 'Resumen',  icon: '◈' },
  { id: 'kanban',   label: 'Tareas',   icon: '⬡' },
  { id: 'files',    label: 'Archivos', icon: '↑' },
  { id: 'history',  label: 'Historial', icon: '◉' },
]

interface Props {
  activeTab: TabId
  onChange: (tab: TabId) => void
  filesCount?: number
}

export function ProjectTabs({ activeTab, onChange, filesCount }: Props) {
  return (
    <div className="flex border-b border-slate-200 mb-6 gap-1">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === tab.id
              ? 'border-brand-700 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="text-base leading-none">{tab.icon}</span>
          {tab.label}
          {tab.id === 'files' && filesCount !== undefined && (
            <span className="ml-1 text-xs bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5">{filesCount}</span>
          )}
        </button>
      ))}
    </div>
  )
}
