import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { SystemSettings, PermissionRow, SystemStats } from '@/types'
import { SystemConfigClient } from '@/components/admin/system/SystemConfigClient'

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

export default async function SystemConfigPage() {
  const user = await getServerUser()
  if (!user || user.role !== 'ADMIN') redirect('/dashboard')

  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value ?? ''

  const [settings, permissions, stats] = await Promise.all([
    apiFetch<SystemSettings>('/api/admin/system/settings', token),
    apiFetch<PermissionRow[]>('/api/admin/system/permissions', token),
    apiFetch<SystemStats>('/api/admin/system/stats', token),
  ])

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Configuración del sistema</h1>
        <p className="text-sm text-slate-500 mt-0.5">General, notificaciones, permisos y estadísticas del sistema</p>
      </div>
      <SystemConfigClient
        initialSettings={settings ?? {}}
        permissions={permissions ?? []}
        stats={stats ?? null}
      />
    </div>
  )
}
