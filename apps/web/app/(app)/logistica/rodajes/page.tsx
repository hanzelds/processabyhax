import { getServerUser } from '@/lib/auth'
import { cookies } from 'next/headers'
import { Shoot } from '@/types'
import { RodajesClient } from './RodajesClient'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'
async function apiFetch<T>(path: string, token: string): Promise<T | null> {
  try {
    const r = await fetch(`${API}${path}`, { headers: { Cookie: `token=${token}` }, cache: 'no-store' })
    if (!r.ok) return null
    return r.json()
  } catch { return null }
}

export default async function RodajesPage() {
  const user = await getServerUser()
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value || ''
  if (!user) return null
  const [shoots, clientsRaw] = await Promise.all([
    apiFetch<Shoot[]>('/api/shoots', token),
    apiFetch<Array<{ id: string; name: string }>>('/api/clients', token),
  ])
  const clients = (clientsRaw ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))
  return <RodajesClient shoots={shoots ?? []} userRole={user.role} clients={clients} />
}
