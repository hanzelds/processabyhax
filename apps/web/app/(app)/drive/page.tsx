import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { User } from '@/types'
import { DriveClient } from './DriveClient'

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

interface DriveStatus {
  connected: boolean
  connectedBy: { id: string; name: string } | null
  connectedAt: string | null
}

export default async function DrivePage() {
  const me = await serverFetch<User>('/api/auth/me')
  if (!me) redirect('/login')

  const status = await serverFetch<DriveStatus>('/api/drive/status') ?? { connected: false, connectedBy: null, connectedAt: null }

  return (
    <DriveClient
      isAdmin={me.role === 'ADMIN' || me.role === 'LEAD'}
      initialStatus={status}
    />
  )
}
