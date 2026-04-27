'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.post('/api/auth/login', { email, password })
      router.replace('/dashboard')
      router.refresh()
    } catch (err: any) {
      const msg: string = err?.message ?? ''
      if (msg.includes('suspendida') || msg.includes('inactiva')) {
        router.push('/account-suspended'); return
      }
      if (msg.includes('activada') || msg.includes('INVITED')) {
        setError('Tu cuenta aún no ha sido activada. Revisa tu email.')
      } else {
        setError('Correo o contraseña incorrectos.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[#0d1117]">

      {/* ── Panel izquierdo ─────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[52%] relative overflow-hidden">

        {/* Gradient blobs */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#17394f]/60 via-[#0d1117] to-[#0d1117]" />
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#17394f]/30 rounded-full blur-[100px] -translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#0a2535]/50 rounded-full blur-[80px] translate-x-1/4 translate-y-1/4" />

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative z-10 flex flex-col h-full p-14 justify-between">

          {/* Logo area */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
              <ProcessaIcon />
            </div>
            <div>
              <p className="text-white font-semibold tracking-tight">Processa</p>
              <p className="text-white/30 text-xs">by Hax Estudio Creativo</p>
            </div>
          </div>

          {/* Main copy */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
                Todo el trabajo<br />
                <span className="text-white/35">en un solo lugar.</span>
              </h1>
              <p className="text-white/40 text-base leading-relaxed max-w-xs">
                Clientes, proyectos y tareas del equipo — sin depender de WhatsApp ni emails.
              </p>
            </div>

            {/* Feature tiles */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Proyectos',  sub: 'Kanban por cliente'     },
                { label: 'Equipo',     sub: 'Carga de trabajo real'  },
                { label: 'Clientes',   sub: 'Historial completo'     },
                { label: 'Dashboard',  sub: 'Alertas y métricas'     },
              ].map(f => (
                <div key={f.label}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors">
                  <p className="text-white/80 text-sm font-medium">{f.label}</p>
                  <p className="text-white/30 text-xs mt-0.5">{f.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/25 text-xs font-medium tracking-wide uppercase">Hax Estudio Creativo</p>
              <p className="text-white/15 text-xs mt-0.5">hax.com.do</p>
            </div>
            <p className="text-white/15 text-xs">© 2026</p>
          </div>
        </div>
      </div>

      {/* ── Panel derecho (formulario) ───────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="w-full max-w-[360px]">

          {/* Logo mobile */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
              <ProcessaIcon />
            </div>
            <span className="font-semibold text-white tracking-tight">Processa</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight">Bienvenido</h2>
            <p className="text-white/35 text-sm mt-1">Ingresa tus credenciales para continuar</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/40 uppercase tracking-wider">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nombre@hax.com.do"
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl text-sm text-white bg-white/[0.05] border border-white/[0.08] placeholder:text-white/20 outline-none transition-all duration-150 focus:bg-white/[0.08] focus:border-white/20"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-white/40 uppercase tracking-wider">
                  Contraseña
                </label>
                <Link href="/forgot-password"
                  className="text-xs text-white/30 hover:text-white/60 transition-colors">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white bg-white/[0.05] border border-white/[0.08] placeholder:text-white/20 outline-none transition-all duration-150 focus:bg-white/[0.08] focus:border-white/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full mt-2 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-white text-[#0d1117] transition-all duration-150 hover:bg-white/90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Ingresando…</>
              ) : (
                <>Entrar al sistema<ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-white/20 mt-8">
            ¿Problemas de acceso?{' '}
            <a href="mailto:hanzel@hax.com.do"
              className="text-white/40 hover:text-white/60 transition-colors underline underline-offset-2">
              hanzel@hax.com.do
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

function ProcessaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="6" height="6" rx="1" fill="white" fillOpacity="0.85" />
      <rect x="10" y="2" width="6" height="6" rx="1" fill="white" fillOpacity="0.85" />
      <rect x="2" y="10" width="6" height="6" rx="1" fill="white" fillOpacity="0.85" />
      <rect x="10" y="10" width="6" height="6" rx="1" fill="white" fillOpacity="0.4" />
    </svg>
  )
}
