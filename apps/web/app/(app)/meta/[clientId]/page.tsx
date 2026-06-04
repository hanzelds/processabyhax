import { cookies } from 'next/headers'
import { getServerUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { Client } from '@/types'
import { MetaClientDashboard } from '@/components/meta/MetaClientDashboard'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

async function getClient(token: string, id: string): Promise<Client | null> {
  const res = await fetch(`${API}/api/clients/${id}`, {
    headers: { Cookie: `token=${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

export default async function MetaClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const user = await getServerUser()
  if (!user || user.role === 'TEAM' || user.role === 'PARTNER') redirect('/dashboard')

  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value || ''
  const client = await getClient(token, clientId)
  if (!client) notFound()

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link href="/meta" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Meta Ads
        </Link>
      </div>
      <MetaClientDashboard
        clientId={client.id}
        clientName={client.name}
        clientColor={client.color}
        isAdmin={user.role === 'ADMIN'}
      />
    </div>
  )
}
