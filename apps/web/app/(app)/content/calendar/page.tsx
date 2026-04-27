import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { User, ContentPiece, Client } from '@/types'
import { CalendarView } from '@/components/content/calendar/CalendarView'

async function serverFetch<T>(path: string): Promise<T | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  const base = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:4100'
  const res = await fetch(`${base}${path}`, {
    headers: { Cookie: `token=${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

export default async function CalendarPage() {
  const me = await serverFetch<User>('/api/auth/me')
  if (!me) redirect('/login')
  if (me.role === 'TEAM') redirect('/dashboard')

  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  const [pieces, inbox, clients] = await Promise.all([
    serverFetch<ContentPiece[]>(`/api/content/calendar?year=${year}&month=${month}`),
    serverFetch<ContentPiece[]>('/api/content/inbox'),
    serverFetch<Client[]>('/api/clients'),
  ])

  return (
    <div className="p-4 lg:p-6 h-full flex flex-col">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900">Calendario de contenido</h1>
        <p className="text-sm text-slate-500 mt-0.5">Programación y seguimiento de publicaciones</p>
      </div>
      <div className="flex-1 min-h-0">
        <CalendarView
          initialPieces={pieces ?? []}
          initialInbox={inbox ?? []}
          clients={clients ?? []}
          isAdmin={me.role === 'ADMIN' || me.role === 'LEAD'}
        />
      </div>
    </div>
  )
}
