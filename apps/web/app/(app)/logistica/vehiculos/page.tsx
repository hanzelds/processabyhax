import { getServerUser } from '@/lib/auth'
import { cookies } from 'next/headers'
import { VehicleItem } from '@/types'
import { VehiculosClient } from './VehiculosClient'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'
async function apiFetch<T>(path: string, token: string): Promise<T | null> {
  try {
    const r = await fetch(`${API}${path}`, { headers: { Cookie: `token=${token}` }, cache: 'no-store' })
    if (!r.ok) return null
    return r.json()
  } catch { return null }
}

export default async function VehiculosPage() {
  const user = await getServerUser()
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value || ''
  if (!user) return null
  const vehicles = await apiFetch<VehicleItem[]>('/api/vehicles', token)
  return <VehiculosClient vehicles={vehicles ?? []} userRole={user.role} />
}
