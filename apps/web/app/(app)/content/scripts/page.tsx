import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { User, Script, Client, ContentBrief } from '@/types'
import { ScriptListClient } from '@/components/content/scripts/ScriptListClient'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

async function serverFetch<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Cookie: `token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

export default async function ScriptsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value ?? ''

  const me = await serverFetch<User>('/api/auth/me', token)
  if (!me) redirect('/login')

  const [scripts, clients, briefs] = await Promise.all([
    serverFetch<Script[]>('/api/scripts', token),
    serverFetch<Client[]>('/api/clients', token),
    serverFetch<ContentBrief[]>('/api/briefs', token),
  ])

  return (
    <ScriptListClient
      me={me}
      initialScripts={scripts ?? []}
      clients={clients ?? []}
      briefs={briefs ?? []}
    />
  )
}
