'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Client, ClientContact, Tag, ClientNote, ClientHistoryEntry, ClientMetrics } from '@/types'
import { CLIENT_STATUS_LABEL, CLIENT_STATUS_COLOR, CLIENT_TIER_LABEL, CLIENT_TIER_COLOR } from '@/lib/utils'
import { ClientTabs, ClientTabId } from './ClientTabs'
import { ClientInfoBlock } from './profile/ClientInfoBlock'
import { ClientTagsBlock } from './profile/ClientTagsBlock'
import { ClientContactsBlock } from './profile/ClientContactsBlock'
import { ClientProjectsTab } from './projects/ClientProjectsTab'
import { ClientMetricsTab } from './metrics/ClientMetricsTab'
import { ClientNotesTab } from './notes/ClientNotesTab'
import { ClientHistoryTab } from './history/ClientHistoryTab'

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
}

export function ClientDetailClient({ client: initialClient, contacts, metrics, notesFeed, historyData, currentUserId, isAdmin }: Props) {
  const [client, setClient]     = useState(initialClient)
  const [activeTab, setActiveTab] = useState<ClientTabId>('profile')

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
    </div>
  )
}
