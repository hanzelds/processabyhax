import { getServerUser } from '@/lib/auth'
import { redirect }      from 'next/navigation'
import { DayPlannerClient } from './DayPlannerClient'

export const metadata = { title: 'Mi Día — Processa' }

export default async function DayPlannerPage() {
  const user = await getServerUser()
  if (!user)               return null
  if (user.role !== 'ADMIN') redirect('/dashboard')
  return <DayPlannerClient />
}
