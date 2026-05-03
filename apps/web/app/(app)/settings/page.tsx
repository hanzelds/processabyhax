import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { User, UserSession } from '@/types'
import { SettingsClient } from '@/components/settings/SettingsClient'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

async function apiFetch<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Cookie: `token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) redirect('/login')

  const me = await apiFetch<User>('/api/auth/me', token)
  if (!me) redirect('/login')

  const [fullUser, sessions] = await Promise.all([
    apiFetch<User>(`/api/users/${me.id}`, token),
    apiFetch<UserSession[]>(`/api/users/${me.id}/sessions`, token),
  ])

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Configuración</h1>
        <p className="text-sm text-slate-500 mt-0.5">Gestiona tu perfil, contraseña y sesiones activas</p>
      </div>
      <SettingsClient
        user={fullUser ?? me}
        sessions={sessions ?? []}
      />
    </div>
  )
}
