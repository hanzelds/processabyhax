import { cookies } from 'next/headers'
import { getServerUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Client } from '@/types'
import { NewClientModal } from '@/components/ui/NewClientModal'
import { ClientCard } from '@/components/clients/ClientCard'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

async function getClients(token: string): Promise<Client[]> {
  const res = await fetch(`${API}/api/clients`, {
    headers: { Cookie: `token=${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  return res.json()
}

export default async function ClientsPage() {
  const user = await getServerUser()
  if (user?.role !== 'ADMIN' && user?.role !== 'LEAD') redirect('/dashboard')

  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value || ''
  const clients = await getClients(token)

  const active    = clients.filter(c => c.status === 'ACTIVE')
  const potential = clients.filter(c => c.status === 'POTENTIAL')
  const inactive  = clients.filter(c => c.status === 'INACTIVE')

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clientes</h1>
          <p className="text-slate-500 text-sm mt-1">
            {active.length} activo{active.length !== 1 ? 's' : ''}
            {potential.length > 0 && ` · ${potential.length} potencial${potential.length !== 1 ? 'es' : ''}`}
          </p>
        </div>
        <NewClientModal />
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-4xl mb-4">◉</p>
          <p className="text-lg font-medium text-slate-500">No hay clientes aún</p>
          <p className="text-sm mt-1">Crea el primer cliente para comenzar</p>
        </div>
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Activos ({active.length})</h2>
              <div className="grid gap-3">{active.map(c => <ClientCard key={c.id} client={c} />)}</div>
            </section>
          )}
          {potential.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Potenciales ({potential.length})</h2>
              <div className="grid gap-3">{potential.map(c => <ClientCard key={c.id} client={c} />)}</div>
            </section>
          )}
          {inactive.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Inactivos ({inactive.length})</h2>
              <div className="grid gap-3">{inactive.map(c => <ClientCard key={c.id} client={c} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
