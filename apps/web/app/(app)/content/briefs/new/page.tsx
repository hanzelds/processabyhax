import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { User, Client } from '@/types'
import { NewBriefForm } from './NewBriefForm'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

async function serverFetch<T>(path: string): Promise<T | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  const res = await fetch(`${API}${path}`, {
    headers: { Cookie: `token=${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

interface PageProps {
  searchParams: Promise<{ status?: string; clientId?: string }>
}

export default async function NewBriefPage({ searchParams }: PageProps) {
  const me = await serverFetch<User>('/api/auth/me')
  if (!me) redirect('/login')

  const isAdmin = me.role === 'ADMIN' || me.role === 'LEAD'
  if (!isAdmin) redirect('/content/briefs')

  const [clients, users] = await Promise.all([
    serverFetch<Client[]>('/api/clients'),
    serverFetch<User[]>('/api/users'),
  ])

  const params = await searchParams

  return (
    <NewBriefForm
      clients={clients ?? []}
      users={users ?? []}
      defaultStatus={params.status as string | undefined}
      defaultClientId={params.clientId}
      currentUserId={me.id}
    />
  )
}
