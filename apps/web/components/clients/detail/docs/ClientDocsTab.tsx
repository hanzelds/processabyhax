'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DocPageSummary } from '@/types'
import { api } from '@/lib/api'
import { Plus, FileText, ChevronRight, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

function PageRow({ page, depth = 0 }: { page: DocPageSummary; depth?: number }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div
        className="flex items-center gap-2 py-2.5 px-4 hover:bg-slate-50 transition-colors rounded-xl group"
        style={{ paddingLeft: `${16 + depth * 20}px` }}
      >
        {page.children.length > 0 ? (
          <button onClick={() => setOpen(o => !o)} className="text-slate-400 hover:text-slate-600">
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        <Link href={`/docs/${page.id}`} className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-base">{page.icon ?? '📄'}</span>
          <span className="text-sm font-medium text-slate-700 group-hover:text-[#17394f] truncate transition-colors">
            {page.title || 'Sin título'}
          </span>
        </Link>
        <Link
          href={`/docs/${page.id}`}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-[#17394f] font-medium px-2 py-0.5 rounded-lg hover:bg-[#17394f]/5"
        >
          Abrir <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      {open && page.children.map(child => <PageRow key={child.id} page={child} depth={depth + 1} />)}
    </div>
  )
}

interface Props {
  clientId: string
  clientName: string
  initialPages: DocPageSummary[]
  isAdmin: boolean
}

export function ClientDocsTab({ clientId, clientName, initialPages, isAdmin }: Props) {
  const toast = useToast()
  const [pages, setPages] = useState(initialPages)
  const [creating, setCreating] = useState(false)
  const router = useRouter()

  async function newPage() {
    setCreating(true)
    try {
      const created = await api.post<{ id: string }>(`/api/docs/client/${clientId}`, {
        title: 'Sin título',
        icon: '📄',
      })
      router.push(`/docs/${created.id}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al crear página')
      setCreating(false)
    }
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Documentos</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Brand guidelines, tono de voz, procesos y referencias de {clientName}
          </p>
        </div>
        <button
          onClick={newPage}
          disabled={creating}
          className="flex items-center gap-1.5 bg-[#17394f] text-white text-sm font-medium rounded-lg px-3 py-1.5 hover:bg-[#17394f]/90 transition-colors disabled:opacity-60"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Nueva página
        </button>
      </div>

      {/* Pages list */}
      {pages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-20 flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl">📚</div>
          <div className="text-center">
            <p className="text-slate-700 font-medium">Sin documentos aún</p>
            <p className="text-sm text-slate-400 mt-1">
              Crea brand guidelines, tono de voz o referencias visuales
            </p>
          </div>
          <button
            onClick={newPage}
            disabled={creating}
            className="flex items-center gap-2 bg-[#17394f] text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-[#17394f]/90 transition-colors disabled:opacity-60"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Crear primer documento
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {pages.map(page => <PageRow key={page.id} page={page} />)}
        </div>
      )}
    </div>
  )
}
