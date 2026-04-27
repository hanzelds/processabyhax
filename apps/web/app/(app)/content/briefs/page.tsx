import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { User, ContentBrief, Client } from '@/types'
import { BriefPipeline } from '@/components/content/briefs/BriefPipeline'

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

export default async function BriefsPage() {
  const me = await serverFetch<User>('/api/auth/me')
  if (!me) redirect('/login')

  const isAdmin = me.role === 'ADMIN' || me.role === 'LEAD'

  const [briefs, clients, users] = await Promise.all([
    serverFetch<ContentBrief[]>('/api/briefs'),
    isAdmin ? serverFetch<Client[]>('/api/clients') : Promise.resolve([]),
    isAdmin ? serverFetch<User[]>('/api/users') : Promise.resolve([]),
  ])

  return (
    <div className="p-4 lg:p-6 h-full flex flex-col">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Preproducción</h1>
        <p className="text-sm text-slate-500 mt-0.5">Pipeline de briefs de contenido</p>
      </div>
      <div className="flex-1 min-h-0">
        <BriefPipeline
          initialBriefs={briefs ?? []}
          clients={clients ?? []}
          users={users ?? []}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  )
}
