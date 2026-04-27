import { cookies } from 'next/headers'
import { getServerUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { User } from '@/types'
import { NewUserModal } from '@/components/ui/NewUserModal'
import { UserCard } from '@/components/users/UserCard'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

async function getUsers(token: string): Promise<User[]> {
  const res = await fetch(`${API}/api/users`, {
    headers: { Cookie: `token=${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  return res.json()
}

export default async function UsersPage() {
  const user = await getServerUser()
  if (user?.role !== 'ADMIN' && user?.role !== 'LEAD') redirect('/dashboard')

  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value || ''
  const users = await getUsers(token)

  const active    = users.filter(u => u.status === 'ACTIVE')
  const invited   = users.filter(u => u.status === 'INVITED')
  const suspended = users.filter(u => u.status === 'SUSPENDED')
  const inactive  = users.filter(u => u.status === 'INACTIVE')

  const isAdmin = user?.role === 'ADMIN'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Equipo Hax</h1>
          <p className="text-slate-500 text-sm mt-1">
            {active.length} activo{active.length !== 1 ? 's' : ''}
            {invited.length > 0 && ` · ${invited.length} pendiente${invited.length !== 1 ? 's' : ''}`}
            {suspended.length > 0 && ` · ${suspended.length} suspendido${suspended.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {isAdmin && <NewUserModal />}
      </div>

      <div className="space-y-8">
        {active.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Activos ({active.length})</h2>
            <div className="space-y-2">
              {active.map(u => (
                <UserCard key={u.id} user={u} currentUserId={user?.id ?? ''} isAdmin={isAdmin} />
              ))}
            </div>
          </section>
        )}

        {invited.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-3">Invitación pendiente ({invited.length})</h2>
            <div className="space-y-2">
              {invited.map(u => (
                <UserCard key={u.id} user={u} currentUserId={user?.id ?? ''} isAdmin={isAdmin} />
              ))}
            </div>
          </section>
        )}

        {suspended.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">Suspendidos ({suspended.length})</h2>
            <div className="space-y-2">
              {suspended.map(u => (
                <UserCard key={u.id} user={u} currentUserId={user?.id ?? ''} isAdmin={isAdmin} />
              ))}
            </div>
          </section>
        )}

        {inactive.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Inactivos ({inactive.length})</h2>
            <div className="space-y-2">
              {inactive.map(u => (
                <UserCard key={u.id} user={u} currentUserId={user?.id ?? ''} isAdmin={isAdmin} />
              ))}
            </div>
          </section>
        )}

        {users.length === 0 && (
          <div className="text-center py-20 text-slate-400">
            <p className="text-4xl mb-4">◎</p>
            <p className="text-lg font-medium text-slate-500">Sin miembros aún</p>
          </div>
        )}
      </div>
    </div>
  )
}
