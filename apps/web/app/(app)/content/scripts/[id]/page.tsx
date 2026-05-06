import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { User, Script, User as UserType } from '@/types'
import { ScriptEditorClient } from '@/components/content/scripts/ScriptEditorClient'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

async function serverFetch<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Cookie: `token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function ScriptEditorPage({ params }: Props) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value ?? ''

  const me = await serverFetch<User>('/api/auth/me', token)
  if (!me) redirect('/login')

  const [script, users] = await Promise.all([
    serverFetch<Script>(`/api/scripts/${id}`, token),
    serverFetch<UserType[]>('/api/users', token),
  ])

  if (!script) notFound()

  return (
    <ScriptEditorClient
      me={me}
      initialScript={script}
      users={users ?? []}
    />
  )
}
