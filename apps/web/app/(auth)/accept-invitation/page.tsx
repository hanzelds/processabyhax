'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

function getScore(p: string): number {
  if (!p) return 0
  let s = 0
  if (p.length >= 8) s++
  if (/\d/.test(p)) s++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++
  if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(p)) s++
  return s
}

const BAR_COLORS = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400']
const BAR_LABELS = ['Muy débil', 'Débil', 'Buena', 'Fuerte']

function StrengthBar({ password }: { password: string }) {
  const score = getScore(password)
  if (!password) return null
  return (
    <div className="mt-2 mb-1">
      <div className="flex gap-1">
        {[1,2,3,4].map(i => (
          <div key={i} className={`flex-1 h-0.5 rounded-full transition-all duration-200 ${i <= score ? BAR_COLORS[score - 1] : 'bg-white/10'}`} />
        ))}
      </div>
      <p className="text-xs mt-1.5 text-white/40">{score > 0 ? BAR_LABELS[score - 1] : ''}</p>
    </div>
  )
}

function InvitationForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const token        = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showP, setShowP]       = useState(false)
  const [showC, setShowC]       = useState(false)
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [success, setSuccess]   = useState(false)
  const [userName, setUserName] = useState('')

  if (!token) return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Invitación inválida.</h1>
      <p className="text-white/40 text-sm">Este enlace no es válido o ya fue utilizado.<br />Contacta a un administrador.</p>
    </div>
  )

  if (success) return (
    <div>
      <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-6">
        <span className="text-emerald-400 text-lg">✓</span>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">
        {userName ? `Todo listo, ${userName.split(' ')[0]}.` : 'Cuenta activada.'}
      </h1>
      <p className="text-white/40 text-sm">Tu cuenta está activa. Redirigiendo al login…</p>
    </div>
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (getScore(password) < 3) { setError('La contraseña es demasiado débil'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/auth/accept-invitation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setUserName(d.user?.name || '')
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (e: any) { setError(e.message || 'Error')
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Bienvenido al equipo.</h1>
      <p className="text-white/40 text-sm mb-8">Define tu contraseña para activar tu cuenta en Processa.</p>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/40 uppercase tracking-wider">Contraseña</label>
          <div className="relative">
            <input type={showP ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••" required autoComplete="new-password"
              className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white bg-white/[0.05] border border-white/[0.08] placeholder:text-white/20 outline-none transition-all focus:bg-white/[0.08] focus:border-white/20" />
            <button type="button" onClick={() => setShowP(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
              {showP ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <StrengthBar password={password} />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/40 uppercase tracking-wider">Confirmar contraseña</label>
          <div className="relative">
            <input type={showC ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••••" required autoComplete="new-password"
              className={`w-full px-4 py-3 pr-11 rounded-xl text-sm text-white bg-white/[0.05] border placeholder:text-white/20 outline-none transition-all focus:bg-white/[0.08] ${confirm && password !== confirm ? 'border-red-500/40' : 'border-white/[0.08] focus:border-white/20'}`} />
            <button type="button" onClick={() => setShowC(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
              {showC ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm mt-4">
          <div className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
          {error}
        </div>
      )}

      <button type="submit" disabled={saving || getScore(password) < 3 || password !== confirm}
        className="w-full mt-6 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-white text-[#0d1117] hover:bg-white/90 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Activando…</> : 'Activar mi cuenta'}
      </button>
    </form>
  )
}

export default function AcceptInvitationPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1117] p-6">
      <div className="w-full max-w-[360px]">
        <Suspense fallback={<p className="text-white/30 text-sm">Cargando…</p>}>
          <InvitationForm />
        </Suspense>
      </div>
    </div>
  )
}
