import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { User, Client, ContentBrief } from '@/types'
import { NewPieceForm } from './NewPieceForm'

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
  searchParams: Promise<{ clientId?: string; date?: string }>
}

export default async function NewPiecePage({ searchParams }: PageProps) {
  const me = await serverFetch<User>('/api/auth/me')
  if (!me) redirect('/login')

  const isAdmin = me.role === 'ADMIN' || me.role === 'LEAD'
  if (!isAdmin) redirect('/content/calendar')

  const params = await searchParams
  const clientId = params.clientId ?? ''
  const defaultDate = params.date ?? ''

  const [clients, briefs] = await Promise.all([
    serverFetch<Client[]>('/api/clients'),
    clientId
      ? serverFetch<ContentBrief[]>(`/api/briefs?clientId=${clientId}&status=aprobado`)
      : Promise.resolve([]),
  ])

  // Redirect back to selector if no valid client
  if (!clientId || !(clients ?? []).find(c => c.id === clientId)) {
    redirect('/content/calendar')
  }

  const client = (clients ?? []).find(c => c.id === clientId)!

  return (
    <NewPieceForm
      client={client}
      briefs={briefs ?? []}
      defaultDate={defaultDate}
    />
  )
}
