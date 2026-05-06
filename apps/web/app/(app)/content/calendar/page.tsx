import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { User, ContentPiece, Client } from '@/types'
import { CalendarView } from '@/components/content/calendar/CalendarView'
import { ClientSelector } from '@/components/content/ClientSelector'
import { Building2 } from 'lucide-react'

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
  searchParams: Promise<{ clientId?: string }>
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const me = await serverFetch<User>('/api/auth/me')
  if (!me) redirect('/login')

  const clients = await serverFetch<Client[]>('/api/clients') ?? []
  const params = await searchParams
  const selectedClientId = params.clientId ?? ''
  const selectedClient = clients.find(c => c.id === selectedClientId)

  // No client selected → show selector
  if (!selectedClient) {
    return (
      <div className="p-4 lg:p-6 h-full flex flex-col">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-slate-900">Calendario de contenido</h1>
          <p className="text-sm text-slate-500 mt-0.5">Programación y seguimiento de publicaciones</p>
        </div>
        <ClientSelector clients={clients} returnPath="/content/calendar" />
      </div>
    )
  }

  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  const [pieces, inbox] = await Promise.all([
    serverFetch<ContentPiece[]>(`/api/content/calendar?year=${year}&month=${month}&clientId=${selectedClientId}`),
    serverFetch<ContentPiece[]>(`/api/content/inbox?clientId=${selectedClientId}`),
  ])

  return (
    <div className="p-4 lg:p-6 h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Calendario de contenido</h1>
          <p className="text-sm text-slate-500 mt-0.5">Programación y seguimiento de publicaciones</p>
        </div>
        <Link
          href="/content/calendar"
          className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm hover:border-[#17394f] transition-colors group shrink-0"
        >
          <Building2 className="w-4 h-4 text-slate-400 group-hover:text-[#17394f]" />
          <span className="font-semibold text-slate-800">{selectedClient.name}</span>
          <span className="text-xs text-slate-400 border-l border-slate-200 pl-2 ml-1">cambiar</span>
        </Link>
      </div>
      <div className="flex-1 min-h-0">
        <CalendarView
          initialPieces={pieces ?? []}
          initialInbox={inbox ?? []}
          selectedClientId={selectedClientId}
          isAdmin={me.role === 'ADMIN' || me.role === 'LEAD'}
        />
      </div>
    </div>
  )
}
