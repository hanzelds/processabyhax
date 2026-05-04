import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminTask, AdminTaskRecurrence } from '@/types'
import { AdminTasksClient } from '@/components/admin-tasks/AdminTasksClient'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

async function sf<T>(path: string, cookie: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

export default async function AdminTasksPage() {
  const cookieStore = await cookies()
  const cookie = cookieStore.toString()

  const me = await sf<{ id: string; role: string }>('/api/auth/me', cookie)
  if (!me) redirect('/login')
  if (me.role !== 'ADMIN' && me.role !== 'LEAD') redirect('/dashboard')

  const [tasks, recurrences] = await Promise.all([
    sf<AdminTask[]>('/api/admin/tasks?tab=all', cookie),
    sf<AdminTaskRecurrence[]>('/api/admin/tasks/recurrences', cookie),
  ])

  return (
    <AdminTasksClient
      initialTasks={tasks ?? []}
      initialRecurrences={recurrences ?? []}
    />
  )
}
