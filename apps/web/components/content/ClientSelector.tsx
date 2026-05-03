'use client'

import { Client } from '@/types'
import { useRouter } from 'next/navigation'
import { Building2, ArrowRight } from 'lucide-react'
import { clientBgColor } from '@/lib/utils'

interface Props {
  clients: Client[]
  returnPath: string
}

export function ClientSelector({ clients, returnPath }: Props) {
  const router = useRouter()
  const active   = clients.filter(c => c.status === 'ACTIVE')
  const inactive = clients.filter(c => c.status !== 'ACTIVE')

  return (
    <div className="flex flex-col items-center justify-center flex-1 py-16">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-800">¿Para qué cliente?</h2>
        <p className="text-sm text-slate-500 mt-1">El contenido se gestiona por cliente</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-3xl w-full px-4">
        {active.map(c => {
          const bg = clientBgColor(c.id, c.color)
          return (
            <button
              key={c.id}
              onClick={() => router.push(`${returnPath}?clientId=${c.id}`)}
              className="bg-white border border-slate-200 rounded-2xl text-left hover:shadow-md transition-all group hover:border-slate-300"
              style={{ borderTopColor: bg, borderTopWidth: '4px' }}
            >
              <div className="p-4">
                <p className="font-semibold text-slate-800 text-sm leading-snug">{c.name}</p>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 mt-3 transition-colors" />
              </div>
            </button>
          )
        })}
        {inactive.map(c => {
          const bg = clientBgColor(c.id, c.color)
          return (
            <button
              key={c.id}
              onClick={() => router.push(`${returnPath}?clientId=${c.id}`)}
              className="bg-white border border-slate-100 rounded-2xl text-left opacity-50 hover:opacity-80 transition-all"
              style={{ borderTopColor: bg, borderTopWidth: '4px' }}
            >
              <div className="p-4">
                <p className="font-semibold text-slate-600 text-sm leading-snug">{c.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Inactivo</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
