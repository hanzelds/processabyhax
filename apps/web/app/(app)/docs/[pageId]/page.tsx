import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { DocPage, DocPageSummary } from '@/types'
import { DocPageClient } from './DocPageClient'

async function fetchPage(pageId: string, cookieHeader: string): Promise<DocPage | null> {
  try {
    const res = await fetch(`${process.env.API_INTERNAL_URL}/api/docs/pages/${pageId}`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

async function fetchTree(contextType: string, contextId: string, cookieHeader: string): Promise<DocPageSummary[]> {
  try {
    const res = await fetch(`${process.env.API_INTERNAL_URL}/api/docs/${contextType}/${contextId}`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    })
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

async function fetchMe(cookieHeader: string) {
  try {
    const res = await fetch(`${process.env.API_INTERNAL_URL}/api/auth/me`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

async function fetchContextName(contextType: string, contextId: string, cookieHeader: string): Promise<{ name: string; emoji?: string }> {
  if (contextType === 'workspace') return { name: 'General', emoji: '📝' }
  try {
    const endpoint = contextType === 'client'
      ? `${process.env.API_INTERNAL_URL}/api/clients/${contextId}`
      : `${process.env.API_INTERNAL_URL}/api/teamspaces/${contextId}`
    const res = await fetch(endpoint, { headers: { Cookie: cookieHeader }, cache: 'no-store' })
    if (!res.ok) return { name: 'Contexto' }
    const data = await res.json()
    return { name: data.name, emoji: data.emoji }
  } catch { return { name: 'Contexto' } }
}

interface PageProps {
  params: Promise<{ pageId: string }>
}

export default async function DocPageRoute({ params }: PageProps) {
  const { pageId } = await params
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.toString()

  const [me, page] = await Promise.all([
    fetchMe(cookieHeader),
    fetchPage(pageId, cookieHeader),
  ])

  if (!me) redirect('/login')
  if (!page) redirect('/dashboard')

  const [tree, context] = await Promise.all([
    fetchTree(page.contextType, page.contextId, cookieHeader),
    fetchContextName(page.contextType, page.contextId, cookieHeader),
  ])

  const isAdmin = me.role === 'ADMIN'

  return (
    <DocPageClient
      page={page}
      tree={tree}
      contextName={context.name}
      contextEmoji={context.emoji}
      isAdmin={isAdmin}
    />
  )
}
