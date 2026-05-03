import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DocPageSummary } from '@/types'
import { DocsLandingClient } from './DocsLandingClient'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

async function apiFetch<T>(path: string, cookieHeader: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { headers: { Cookie: cookieHeader }, cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

export default async function DocsLandingPage() {
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.toString()

  const me = await apiFetch<{ id: string; role: string }>('/api/auth/me', cookieHeader)
  if (!me) redirect('/login')

  const [workspacePages, teamspaces, clients] = await Promise.all([
    apiFetch<DocPageSummary[]>('/api/docs/workspace/global', cookieHeader),
    apiFetch<{ id: string; name: string; emoji: string; isMember: boolean }[]>('/api/teamspaces', cookieHeader),
    me.role !== 'TEAM'
      ? apiFetch<{ id: string; name: string }[]>('/api/clients?status=ACTIVE', cookieHeader)
      : Promise.resolve([]),
  ])

  // Fetch client doc trees (only those with docs)
  const clientContexts: { id: string; name: string; pages: DocPageSummary[] }[] = []
  for (const c of (clients ?? []).slice(0, 30)) {
    const pages = await apiFetch<DocPageSummary[]>(`/api/docs/client/${c.id}`, cookieHeader)
    if ((pages ?? []).length > 0) clientContexts.push({ id: c.id, name: c.name, pages: pages! })
  }

  // Teamspace docs (only those with docs)
  const tsContexts: { id: string; name: string; emoji: string; pages: DocPageSummary[] }[] = []
  for (const ts of (teamspaces ?? [])) {
    if (!ts.isMember && me.role !== 'ADMIN') continue
    const pages = await apiFetch<DocPageSummary[]>(`/api/docs/teamspace/${ts.id}`, cookieHeader)
    if ((pages ?? []).length > 0) tsContexts.push({ id: ts.id, name: ts.name, emoji: ts.emoji, pages: pages! })
  }

  return (
    <DocsLandingClient
      workspacePages={workspacePages ?? []}
      teamspaceContexts={tsContexts}
      clientContexts={clientContexts}
      isAdmin={me.role === 'ADMIN'}
    />
  )
}
