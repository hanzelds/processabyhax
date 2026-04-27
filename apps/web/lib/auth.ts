'use server'

import { cookies } from 'next/headers'
import { User } from '@/types'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

export async function getServerUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  try {
    const res = await fetch(`${API}/api/auth/me`, {
      headers: { Cookie: `token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
