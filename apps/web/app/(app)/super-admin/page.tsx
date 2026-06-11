import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { SuperAdminClient } from '@/components/super-admin/SuperAdminClient'
import { Shield } from 'lucide-react'

export const metadata = { title: 'Super Admin — Processa' }

export default async function SuperAdminPage() {
  const user = await getServerUser()
  if (!user || !user.isSuperAdmin) redirect('/dashboard')

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Super Admin</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestión global de organizaciones y suscripciones</p>
        </div>
      </div>

      <SuperAdminClient />
    </div>
  )
}
