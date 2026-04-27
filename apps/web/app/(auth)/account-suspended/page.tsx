import { Lock } from 'lucide-react'

export default function AccountSuspendedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1117] p-6">
      <div className="w-full max-w-[360px]">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-6">
          <Lock className="w-5 h-5 text-white/30" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Acceso suspendido.</h1>
        <p className="text-white/40 text-sm leading-relaxed mb-6">
          Tu cuenta está temporalmente deshabilitada.<br />
          Para más información, contacta a la dirección de Hax.
        </p>
        <a href="mailto:hola@hax.com.do"
          className="text-sm text-white/50 hover:text-white/80 transition-colors underline underline-offset-4">
          hola@hax.com.do
        </a>
      </div>
    </div>
  )
}
