import { cookies } from 'next/headers'
import { getServerUser } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { User, Skill } from '@/types'
import { UserDetailClient } from '@/components/users/detail/UserDetailClient'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

async function apiFetch<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { headers: { Cookie: `token=${token}` }, cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const currentUser = await getServerUser()
  if (!currentUser) redirect('/login')

  const isAdmin = currentUser.role === 'ADMIN'
  const isLead  = currentUser.role === 'LEAD'
  const isOwnProfile = currentUser.id === id

  // Only admin, lead, or the user themselves can view a profile
  if (!isAdmin && !isLead && !isOwnProfile) redirect('/dashboard')

  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value || ''

  const user = await apiFetch<User & { skills: Skill[] }>(`/api/users/${id}`, token)
  if (!user) notFound()

  return (
    <UserDetailClient
      user={user}
      skills={user.skills ?? []}
      currentUserId={currentUser.id}
      isAdmin={isAdmin}
    />
  )
}
