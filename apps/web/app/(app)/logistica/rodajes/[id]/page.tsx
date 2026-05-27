import { getServerUser } from '@/lib/auth'
import { cookies } from 'next/headers'
import { Shoot, LocationItem, GearItem, VehicleItem } from '@/types'
import { RodajeDetailClient } from './RodajeDetailClient'
import { notFound } from 'next/navigation'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'
async function apiFetch<T>(path: string, token: string): Promise<T | null> {
  try {
    const r = await fetch(`${API}${path}`, { headers: { Cookie: `token=${token}` }, cache: 'no-store' })
    if (!r.ok) return null
    return r.json()
  } catch { return null }
}

export default async function RodajeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getServerUser()
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value || ''
  if (!user) return null

  const [shoot, gear, locations, vehicles, clientsRaw] = await Promise.all([
    apiFetch<Shoot>(`/api/shoots/${id}`, token),
    apiFetch<GearItem[]>('/api/gear', token),
    apiFetch<LocationItem[]>('/api/locations', token),
    apiFetch<VehicleItem[]>('/api/vehicles', token),
    apiFetch<Array<{ id: string; name: string }>>('/api/clients', token),
  ])

  if (!shoot) notFound()

  const clients = (clientsRaw ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))

  return (
    <RodajeDetailClient
      shoot={shoot}
      allGear={gear ?? []}
      allLocations={locations ?? []}
      allVehicles={vehicles ?? []}
      allClients={clients}
      userRole={user.role}
      currentUserId={user.id}
    />
  )
}
