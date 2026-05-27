import { getServerUser } from '@/lib/auth'
import { cookies } from 'next/headers'
import { LocationItem } from '@/types'
import { LocacionesClient } from './LocacionesClient'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'
async function apiFetch<T>(path: string, token: string): Promise<T | null> {
  try {
    const r = await fetch(`${API}${path}`, { headers: { Cookie: `token=${token}` }, cache: 'no-store' })
    if (!r.ok) return null
    return r.json()
  } catch { return null }
}

export default async function LocacionesPage() {
  const user = await getServerUser()
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value || ''
  if (!user) return null
  const locations = await apiFetch<LocationItem[]>('/api/locations', token)
  return <LocacionesClient locations={locations ?? []} userRole={user.role} />
}
