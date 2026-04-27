import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getServerUser } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

async function fetchCount(path: string, token: string): Promise<number> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Cookie: `token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return 0
    const d = await res.json()
    return typeof d.count === 'number' ? d.count : 0
  } catch { return 0 }
}

async function fetchAdminAlerts(token: string): Promise<number> {
  try {
    const res = await fetch(`${API}/api/admin/tasks/alerts`, {
      headers: { Cookie: `token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return 0
    const d = await res.json()
    return (d.overdue ?? 0) + (d.dueSoon ?? 0)
  } catch { return 0 }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value ?? ''

  const [taskBadge, adminAlerts] = await Promise.all([
    fetchCount('/api/tasks/my/count', token),
    user.role === 'ADMIN' ? fetchAdminAlerts(token) : Promise.resolve(0),
  ])

  return (
    <AppShell user={user} taskBadge={taskBadge} adminAlerts={adminAlerts}>
      {children}
    </AppShell>
  )
}
