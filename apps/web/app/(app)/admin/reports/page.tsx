import { getServerUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ReportsClient } from './ReportsClient'

export default async function ReportsPage() {
  const user = await getServerUser()
  if (!user) return null
  if (user.role === 'TEAM') redirect('/dashboard')
  return <ReportsClient />
}
