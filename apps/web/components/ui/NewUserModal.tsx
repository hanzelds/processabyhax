'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

const AREAS = [
  'Diseño gráfico', 'Dirección de arte', 'Motion & video', 'Fotografía',
  'Copywriting', 'Estrategia de contenido', 'Community management',
  'Desarrollo web', 'Producción', 'Account management', 'Dirección',
]

interface InviteResult {
  user: { id: string; name: string; email: string; role: string }
  invitationLink: string
}

export function NewUserModal() {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [name, setName]     = useState('')
  const [email, setEmail]   = useState('')
  const [role, setRole]     = useState<'ADMIN' | 'LEAD' | 'TEAM'>('TEAM')
  const [area, setArea]     = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [result, setResult] = useState<InviteResult | null>(null)

  function reset() {
    setName(''); setEmail(''); setRole('TEAM'); setArea('')
    setError(''); setResult(null)
  }

  function handleClose() {
    setOpen(false)
    reset()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await api.post<InviteResult>('/api/users', { name, email, role, area: area || undefined })
      setResult(res)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear usuario')
    } finally { setSaving(false) }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        + Invitar miembro
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={handleClose}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Invitar miembro</h3>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>

            {result ? (
              /* Success: show invitation link */
              <div className="px-6 py-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-lg">✓</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{result.user.name}</p>
                    <p className="text-xs text-slate-400">Invitación creada exitosamente</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Enlace de invitación (expira en 72h):</p>
                  <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-2">
                    <p className="text-xs text-slate-600 truncate flex-1">{result.invitationLink}</p>
                    <button
                      onClick={() => navigator.clipboard.writeText(result.invitationLink)}
                      className="text-xs text-brand-700 hover:text-brand-800 font-medium shrink-0"
                    >
                      Copiar
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {process.env.NEXT_PUBLIC_EMAIL_ENABLED === 'true'
                      ? 'También se envió por email al usuario.'
                      : 'Comparte este enlace con el usuario directamente.'}
                  </p>
                </div>
                <button onClick={handleClose} className="w-full bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium rounded-lg py-2 transition-colors">
                  Listo
                </button>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Nombre completo *</label>
                  <input required placeholder="María García"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Email *</label>
                  <input required type="email" placeholder="maria@hax.com.do"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Rol</label>
                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                      value={role} onChange={e => setRole(e.target.value as 'ADMIN' | 'LEAD' | 'TEAM')}>
                      <option value="TEAM">Team</option>
                      <option value="LEAD">Lead</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Área</label>
                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                      value={area} onChange={e => setArea(e.target.value)}>
                      <option value="">Sin área</option>
                      {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>

                <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                  El usuario recibirá un enlace para crear su propia contraseña. La invitación expira en 72 horas.
                </p>

                {error && <p className="text-red-500 text-xs">{error}</p>}

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={handleClose}
                    className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-lg py-2 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg py-2 transition-colors">
                    {saving ? 'Enviando...' : 'Enviar invitación'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
