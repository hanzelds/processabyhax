import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { DocHomeStats, DocPageSummary } from '@/types'
import { DocHomeClient } from './DocHomeClient'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

async function sf<T>(path: string, cookie: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { headers: { Cookie: cookie }, cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

async function fetchContextName(contextType: string, contextId: string, cookie: string): Promise<{ name: string; emoji?: string }> {
  if (contextType === 'workspace') return { name: 'General', emoji: '📝' }
  const endpoint = contextType === 'client'
    ? `/api/clients/${contextId}`
    : `/api/teamspaces/${contextId}`
  const data = await sf<{ name: string; emoji?: string }>(endpoint, cookie)
  return data ? { name: data.name, emoji: data.emoji } : { name: 'Contexto' }
}

interface PageProps {
  params: Promise<{ contextType: string; contextId: string }>
}

export default async function DocHomePage({ params }: PageProps) {
  const { contextType, contextId } = await params
  const cookieStore = await cookies()
  const cookie = cookieStore.toString()

  const me = await sf<{ id: string; role: string }>('/api/auth/me', cookie)
  if (!me) redirect('/login')

  const [stats, tree, context] = await Promise.all([
    sf<DocHomeStats>(`/api/docs/home/${contextType}/${contextId}`, cookie),
    sf<DocPageSummary[]>(`/api/docs/${contextType}/${contextId}`, cookie),
    fetchContextName(contextType, contextId, cookie),
  ])

  const isAdmin = me.role === 'ADMIN' || me.role === 'LEAD'

  return (
    <DocHomeClient
      contextType={contextType as 'teamspace' | 'client' | 'workspace'}
      contextId={contextId}
      contextName={context.name}
      contextEmoji={context.emoji}
      stats={stats ?? { total: 0, statusMap: {}, recentPages: [], recentVersions: [] }}
      initialTree={tree ?? []}
      isAdmin={isAdmin}
    />
  )
}
