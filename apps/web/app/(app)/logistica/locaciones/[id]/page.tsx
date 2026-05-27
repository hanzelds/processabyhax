import { getServerUser } from '@/lib/auth'
import { cookies } from 'next/headers'
import { LocationItem } from '@/types'
import { LocacionDetailClient } from './LocacionDetailClient'
import { notFound } from 'next/navigation'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'
async function apiFetch<T>(path: string, token: string): Promise<T | null> {
  try {
    const r = await fetch(`${API}${path}`, { headers: { Cookie: `token=${token}` }, cache: 'no-store' })
    if (!r.ok) return null
    return r.json()
  } catch { return null }
}

export default async function LocacionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getServerUser()
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value || ''
  if (!user) return null
  const location = await apiFetch<LocationItem & { shoots: Array<{ id: string; title: string; shootDate: string; status: string }> }>(`/api/locations/${id}`, token)
  if (!location) notFound()
  return <LocacionDetailClient location={location} userRole={user.role} />
}
