'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Client } from '@/types'
import { ClientCard } from './ClientCard'

export function ArchivedClientsSection({ clients }: { clients: Client[] }) {
  const [open, setOpen] = useState(false)

  return (
    <section>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 hover:text-slate-500 transition-colors"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        Archivados ({clients.length})
      </button>
      {open && (
        <div className="grid gap-3">
          {clients.map(c => <ClientCard key={c.id} client={c} archived />)}
        </div>
      )}
    </section>
  )
}
