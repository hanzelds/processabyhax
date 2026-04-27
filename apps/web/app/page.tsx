import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'

export default async function HomePage() {
  const user = await getServerUser()
  if (!user) redirect('/login')
  redirect('/dashboard')
}
