'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Copy, Check, ExternalLink, RefreshCw, Send } from 'lucide-react'

interface TokenInfo {
  token: string
  month: string
  expiresAt: string
  portalUrl: string
  emailSent?: boolean
}

interface Objective {
  engagementGoal?: string | null
  reachGoal?: string | null
  followersGoal?: string | null
  leadsGoal?: string | null
}

interface Props {
  clientId: string
  isAdmin: boolean
}

function currentMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(s: string) {
  const [y, m] = s.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })
}

const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/20 focus:border-[#17394f]/40 transition-colors resize-none'

export function ClientPortalTab({ clientId, isAdmin }: Props) {
  const month = currentMonthStr()

  const [token, setToken]         = useState<TokenInfo | null>(null)
  const [objective, setObjective] = useState<Objective>({})
  const [loading, setLoading]     = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending]     = useState(false)
  const [copied, setCopied]       = useState(false)
  const [savingObj, setSavingObj] = useState(false)
  const [savedObj, setSavedObj]   = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [t, obj] = await Promise.all([
          api.get<TokenInfo | null>(`/api/portal/admin/clients/${clientId}/portal-token?month=${month}`),
          api.get<Objective | null>(`/api/portal/admin/clients/${clientId}/monthly-objectives?month=${month}`),
        ])
        setToken(t)
        setObjective(obj ?? {})
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
    }
    load()
  }, [clientId, month])

  async function generate(sendEmail = false) {
    setGenerating(true); setError('')
    try {
      const result = await api.post<TokenInfo>(`/api/portal/admin/clients/${clientId}/portal-token`, {
        month, sendEmail,
      })
      setToken(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al generar token')
    } finally { setGenerating(false) }
  }

  async function sendLink() {
    setSending(true); setError('')
    try {
      const result = await api.post<TokenInfo>(`/api/portal/admin/clients/${clientId}/portal-token`, {
        month, sendEmail: true,
      })
      setToken(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al enviar email')
    } finally { setSending(false) }
  }

  function copyUrl() {
    if (!token) return
    navigator.clipboard.writeText(token.portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveObjective() {
    setSavingObj(true)
    try {
      await api.put(`/api/portal/admin/clients/${clientId}/monthly-objectives`, { month, ...objective })
      setSavedObj(true)
      setTimeout(() => setSavedObj(false), 2000)
    } catch { /* ignore */ } finally { setSavingObj(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-300">
        <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-2xl">

      {/* ── Token section ── */}
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">
          Portal de cliente — {monthLabel(month)}
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Genera un link único que el cliente puede usar para revisar y aprobar el contenido del mes sin necesidad de login.
        </p>

        {token ? (
          <div className="space-y-3">
            {/* URL display */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-2">
              <p className="flex-1 text-sm text-[#17394f] font-mono truncate">{token.portalUrl}</p>
              <button
                onClick={copyUrl}
                className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-white transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              <a
                href={token.portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-white transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver
              </a>
            </div>

            {/* Meta */}
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>Vence: {new Date(token.expiresAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>

            {/* Actions */}
            {isAdmin && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={sendLink}
                  disabled={sending}
                  className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 bg-[#17394f] hover:bg-[#17394f]/90 text-white rounded-xl transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sending ? 'Enviando…' : 'Enviar por email al cliente'}
                </button>
                <button
                  onClick={() => generate(false)}
                  disabled={generating}
                  className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                  {generating ? 'Regenerando…' : 'Regenerar link'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center">
            <p className="text-sm text-slate-500 mb-4">
              No hay portal activo para {monthLabel(month)}. Genera un link para compartir con el cliente.
            </p>
            {isAdmin && (
              <div className="flex gap-2 justify-center flex-wrap">
                <button
                  onClick={() => generate(false)}
                  disabled={generating}
                  className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 bg-[#17394f] hover:bg-[#17394f]/90 text-white rounded-xl transition-colors disabled:opacity-50"
                >
                  {generating ? 'Generando…' : 'Generar link de portal'}
                </button>
                <button
                  onClick={() => generate(true)}
                  disabled={generating}
                  className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 border border-[#17394f] text-[#17394f] rounded-xl hover:bg-[#17394f]/5 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {generating ? 'Generando…' : 'Generar y enviar por email'}
                </button>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {/* ── Monthly objectives ── */}
      {isAdmin && (
        <div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">Objetivos del mes</h3>
          <p className="text-sm text-slate-500 mb-4">
            Estos textos aparecerán en el portal del cliente como los objetivos del mes por KPI.
          </p>

          <div className="space-y-3">
            {[
              { key: 'engagementGoal', label: '💬 Engagement', placeholder: 'Ej: Aumentar likes, comentarios y shares en un 20%' },
              { key: 'reachGoal',      label: '📡 Alcance',    placeholder: 'Ej: Llegar a nuevas cuentas fuera de seguidores actuales' },
              { key: 'followersGoal',  label: '👥 Seguidores', placeholder: 'Ej: Crecer la comunidad con 200 seguidores de calidad' },
              { key: 'leadsGoal',      label: '🎯 Leads',      placeholder: 'Ej: Captar potenciales clientes desde el contenido' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-semibold text-slate-500 block mb-1">{f.label}</label>
                <textarea
                  rows={2}
                  placeholder={f.placeholder}
                  value={(objective as Record<string, string | null | undefined>)[f.key] ?? ''}
                  onChange={e => setObjective(prev => ({ ...prev, [f.key]: e.target.value || null }))}
                  className={INPUT}
                />
              </div>
            ))}

            <button
              onClick={saveObjective}
              disabled={savingObj}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 bg-[#17394f] hover:bg-[#17394f]/90 disabled:opacity-50 text-white rounded-xl transition-colors"
            >
              {savedObj ? <Check className="w-4 h-4" /> : null}
              {savingObj ? 'Guardando…' : savedObj ? 'Guardado' : 'Guardar objetivos'}
            </button>
          </div>
        </div>
      )}

      {/* ── Instructions ── */}
      <div className="bg-[#17394f]/5 border border-[#17394f]/20 rounded-2xl p-5">
        <h4 className="text-sm font-semibold text-[#17394f] mb-2">¿Cómo funciona el portal?</h4>
        <ul className="text-sm text-slate-600 space-y-1.5 list-none">
          <li>• El cliente accede con el link — no necesita contraseña</li>
          <li>• Puede aprobar piezas individuales o todo de una vez</li>
          <li>• Si solicita cambios, elige el tipo y describe qué cambiar</li>
          <li>• Tú recibes un email inmediato con el feedback</li>
          <li>• Los estados en Processa se actualizan automáticamente</li>
          <li>• El link expira al final del mes + 7 días de gracia</li>
        </ul>
      </div>
    </div>
  )
}
