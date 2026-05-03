'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Client, ClientContact, Tag, ClientNote, ClientHistoryEntry, ClientMetrics } from '@/types'
import { CLIENT_STATUS_LABEL, CLIENT_STATUS_COLOR, CLIENT_TIER_LABEL, CLIENT_TIER_COLOR, clientBgColor } from '@/lib/utils'
import { ClientTabs, ClientTabId } from './ClientTabs'
import { ClientInfoBlock } from './profile/ClientInfoBlock'
import { ClientTagsBlock } from './profile/ClientTagsBlock'
import { ClientContactsBlock } from './profile/ClientContactsBlock'
import { ClientProjectsTab } from './projects/ClientProjectsTab'
import { ClientMetricsTab } from './metrics/ClientMetricsTab'
import { ClientNotesTab } from './notes/ClientNotesTab'
import { ClientHistoryTab } from './history/ClientHistoryTab'
import { ClientPortalTab } from './portal/ClientPortalTab'
import { ClientDocsTab } from './docs/ClientDocsTab'
import { api } from '@/lib/api'
import { Trash2 } from 'lucide-react'
import { DocPageSummary } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'

interface NotesFeedData { pinned: ClientNote[]; notes: ClientNote[]; total: number; hasMore: boolean }
interface HistoryData { entries: ClientHistoryEntry[]; total: number; hasMore: boolean }

interface Props {
  client: Client
  contacts: ClientContact[]
  metrics: ClientMetrics
  notesFeed: NotesFeedData
  historyData: HistoryData
  currentUserId: string
  isAdmin: boolean
  initialDocs: DocPageSummary[]
}

export function ClientDetailClient({ client: initialClient, contacts, metrics, notesFeed, historyData, currentUserId, isAdmin, initialDocs }: Props) {
  const [client, setClient]     = useState(initialClient)
  const searchParams            = useSearchParams()
  const tabParam                = searchParams.get('tab') as ClientTabId | null
  const [activeTab, setActiveTab] = useState<ClientTabId>(tabParam ?? 'profile')
  const [deleting, setDeleting] = useState(false)
  const router  = useRouter()
  const toast   = useToast()
  const confirm = useConfirm()

  async function handleDelete() {
    const totalProjects = client._count?.projects ?? client.totalProjects ?? 0
    if (totalProjects > 0) {
      toast.error(`No se puede eliminar "${client.name}" porque tiene ${totalProjects} proyecto${totalProjects > 1 ? 's' : ''} asociado${totalProjects > 1 ? 's' : ''}. Elimina o archiva los proyectos primero.`)
      return
    }
    const ok = await confirm({
      title: 'Eliminar cliente',
      message: `¿Eliminar permanentemente a "${client.name}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    setDeleting(true)
    try {
      await api.delete(`/api/clients/${client.id}`)
      router.push('/clients')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar el cliente')
      setDeleting(false)
    }
  }

  const totalNotes = notesFeed.pinned.length + notesFeed.total

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
        <Link href="/clients" className="hover:text-slate-600 transition-colors">Clientes</Link>
        <span>/</span>
        <span className="text-slate-700 font-medium truncate">{client.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl shrink-0 mt-0.5"
            style={{ backgroundColor: clientBgColor(client.id, client.color) }}
          />
          <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-2xl font-semibold text-slate-900">{client.name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${CLIENT_STATUS_COLOR[client.status]}`}>
              {CLIENT_STATUS_LABEL[client.status]}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${CLIENT_TIER_COLOR[client.tier]}`}>
              {CLIENT_TIER_LABEL[client.tier]}
            </span>
          </div>
          {client.industry && <p className="text-sm text-slate-500">{client.industry}</p>}
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition border border-transparent hover:border-red-100 disabled:opacity-50"
            title="Eliminar cliente"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <ClientTabs activeTab={activeTab} onChange={setActiveTab} notesCount={totalNotes} />

      {/* Tab content */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <ClientInfoBlock client={client} onUpdate={setClient} />
            <ClientTagsBlock clientId={client.id} initialTags={client.tags ?? []} />
          </div>
          <ClientContactsBlock clientId={client.id} initialContacts={contacts} />
        </div>
      )}

      {activeTab === 'projects' && (
        <ClientProjectsTab
          clientId={client.id}
          projects={client.projects ?? []}
          isAdmin={isAdmin}
        />
      )}

      {activeTab === 'metrics' && <ClientMetricsTab metrics={metrics} />}

      {activeTab === 'notes' && (
        <ClientNotesTab
          clientId={client.id}
          initialData={notesFeed}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
        />
      )}

      {activeTab === 'history' && (
        <ClientHistoryTab clientId={client.id} initialData={historyData} />
      )}

      {activeTab === 'portal' && (
        <ClientPortalTab clientId={client.id} isAdmin={isAdmin} />
      )}

      {activeTab === 'docs' && (
        <ClientDocsTab
          clientId={client.id}
          clientName={client.name}
          initialPages={initialDocs}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}
