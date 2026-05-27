import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { User, Task } from '@/types'
import { StandaloneTasksClient } from './StandaloneTasksClient'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

async function serverFetch<T>(path: string): Promise<T | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Cookie: `token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

export interface StandaloneMember { id: string; name: string; role: string; area?: string | null }

export interface StandaloneTasks {
  overdue:    Task[]
  today:      Task[]
  pending:    Task[]
  completed:  Task[]
  members:    StandaloneMember[]
  viewUserId: string
}

export default async function TasksPage() {
  const me = await serverFetch<User>('/api/auth/me')
  if (!me) redirect('/login')

  const isAdmin = me.role === 'ADMIN' || me.role === 'LEAD'

  const [tasks, users] = await Promise.all([
    serverFetch<StandaloneTasks>('/api/tasks/standalone'),
    isAdmin ? serverFetch<User[]>('/api/users') : Promise.resolve([]),
  ])

  return (
    <StandaloneTasksClient
      initialTasks={tasks ?? { overdue: [], today: [], pending: [], completed: [], members: [], viewUserId: me.id }}
      users={users ?? []}
      isAdmin={isAdmin}
      currentUser={{ id: me.id, name: me.name, role: me.role }}
    />
  )
}
