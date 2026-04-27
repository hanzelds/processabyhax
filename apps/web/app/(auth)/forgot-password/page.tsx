'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState('')
  const [sent, setSent]         = useState(false)
  const [sentTo, setSentTo]     = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [canResend, setCanResend] = useState(false)

  useEffect(() => {
    if (!sent) return
    setCountdown(60); setCanResend(false)
    const iv = setInterval(() => {
      setCountdown(p => { if (p <= 1) { clearInterval(iv); setCanResend(true); return 0 } return p - 1 })
    }, 1000)
    return () => clearInterval(iv)
  }, [sent])

  async function submit(addr: string) {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addr }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setSentTo(addr); setSent(true)
    } catch (e: any) { setError(e.message || 'Error al enviar')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1117] p-6">
      <div className="w-full max-w-[360px]">

        {/* Back */}
        <Link href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-white/35 hover:text-white/70 transition-colors mb-10">
          <ArrowLeft className="w-4 h-4" /> Volver al login
        </Link>

        {sent ? (
          <div>
            <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-6">
              <Mail className="w-5 h-5 text-white/50" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Revisa tu correo.</h1>
            <p className="text-white/40 text-sm mb-1">Enviamos el enlace a</p>
            <p className="text-white/70 text-sm font-medium mb-2">{sentTo}</p>
            <p className="text-white/25 text-xs mb-8">El enlace expira en 1 hora.</p>

            <p className="text-sm text-white/30">
              ¿No lo recibiste?{' '}
              {canResend ? (
                <button onClick={() => { setSent(false); submit(sentTo) }}
                  className="text-white/60 hover:text-white underline underline-offset-2 transition-colors">
                  Reenviar
                </button>
              ) : (
                <span className="text-white/20 tabular-nums">
                  Reenviar en {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                </span>
              )}
            </p>
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); submit(email) }} noValidate>
            <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Recuperar acceso.</h1>
            <p className="text-white/40 text-sm mb-8">Te enviamos un enlace a tu correo registrado.</p>

            <div className="space-y-1.5 mb-4">
              <label className="text-xs font-medium text-white/40 uppercase tracking-wider">
                Correo electrónico
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="nombre@hax.com.do" required autoComplete="email"
                className="w-full px-4 py-3 rounded-xl text-sm text-white bg-white/[0.05] border border-white/[0.08] placeholder:text-white/20 outline-none transition-all focus:bg-white/[0.08] focus:border-white/20"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
                <div className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !email}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-white text-[#0d1117] hover:bg-white/90 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando…</> : 'Enviar enlace'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
