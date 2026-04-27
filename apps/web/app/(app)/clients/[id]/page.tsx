import { cookies } from 'next/headers'
import { getServerUser } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { Client, ClientContact, ClientMetrics, ClientNote, ClientHistoryEntry } from '@/types'
import { ClientDetailClient } from '@/components/clients/detail/ClientDetailClient'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

async function apiFetch<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { headers: { Cookie: `token=${token}` }, cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

interface NotesFeedData { pinned: ClientNote[]; notes: ClientNote[]; total: number; hasMore: boolean }
interface HistoryData { entries: ClientHistoryEntry[]; total: number; hasMore: boolean }

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getServerUser()
  if (user?.role !== 'ADMIN' && user?.role !== 'LEAD') redirect('/dashboard')

  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value || ''

  const [client, contacts, metrics, notesFeed, historyData] = await Promise.all([
    apiFetch<Client>(`/api/clients/${id}`, token),
    apiFetch<ClientContact[]>(`/api/clients/${id}/contacts`, token),
    apiFetch<ClientMetrics>(`/api/clients/${id}/metrics`, token),
    apiFetch<NotesFeedData>(`/api/clients/${id}/notes`, token),
    apiFetch<HistoryData>(`/api/clients/${id}/history`, token),
  ])

  if (!client) notFound()

  const defaultMetrics: ClientMetrics = { totalProjects: 0, activeProjects: 0, completedTasksTotal: 0, overdueTasksActive: 0, monthsAsClient: null, lastProjectDate: null, teamMembersInvolved: 0, topArea: null, tasksByMonth: [], projectsByStatus: {} }
  const defaultNotes: NotesFeedData = { pinned: [], notes: [], total: 0, hasMore: false }
  const defaultHistory: HistoryData = { entries: [], total: 0, hasMore: false }

  return (
    <ClientDetailClient
      client={client}
      contacts={contacts ?? []}
      metrics={metrics ?? defaultMetrics}
      notesFeed={notesFeed ?? defaultNotes}
      historyData={historyData ?? defaultHistory}
      currentUserId={user?.id ?? ''}
      isAdmin={user?.role === 'ADMIN'}
    />
  )
}
