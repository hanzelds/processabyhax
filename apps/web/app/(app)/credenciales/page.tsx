import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { InstagramCredential, Client } from '@/types'
import { CredentialsClient } from '@/components/credentials/CredentialsClient'
import { KeyRound } from 'lucide-react'

export const metadata = { title: 'Contraseñas — Processa' }

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

export default async function CredencialesPage() {
  const user = await getServerUser()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'LEAD')) redirect('/dashboard')

  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value ?? ''

  const [credentials, clients] = await Promise.all([
    apiFetch<InstagramCredential[]>('/api/credentials', token),
    apiFetch<Client[]>('/api/clients', token),
  ])

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center shrink-0">
          <KeyRound className="w-5 h-5 text-pink-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Contraseñas de Instagram</h1>
          <p className="text-sm text-slate-500 mt-0.5">Credenciales de acceso a las cuentas de los clientes</p>
        </div>
      </div>

      <CredentialsClient
        initialCredentials={credentials ?? []}
        clients={clients ?? []}
      />
    </div>
  )
}
