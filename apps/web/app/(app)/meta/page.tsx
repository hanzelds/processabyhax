import { cookies } from 'next/headers'
import { getServerUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Client } from '@/types'
import { MetaOverview } from '@/components/meta/MetaOverview'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

async function getClients(token: string): Promise<Pick<Client, 'id' | 'name' | 'color'>[]> {
  const res = await fetch(`${API}/api/clients`, {
    headers: { Cookie: `token=${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data: Client[] = await res.json()
  return data.map(c => ({ id: c.id, name: c.name, color: c.color ?? null }))
}

export default async function MetaPage() {
  const user = await getServerUser()
  if (!user || user.role === 'TEAM' || user.role === 'PARTNER') redirect('/dashboard')

  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value || ''
  const clients = await getClients(token)

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <MetaOverview clients={clients} isAdmin={user.role === 'ADMIN'} />
    </div>
  )
}
