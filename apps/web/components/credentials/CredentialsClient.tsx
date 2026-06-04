'use client'

import { useState, useEffect, useRef } from 'react'
import { InstagramCredential, Client } from '@/types'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Eye, EyeOff, Copy, Plus, Pencil, Trash2, KeyRound, X, Check, AtSign } from 'lucide-react'

const INPUT  = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/20'
const LABEL  = 'text-xs font-semibold text-slate-500 mb-1 block'

// ── Revealed password cell ────────────────────────────────────────────────────

function RevealCell({ credId }: { credId: string }) {
  const [password, setPassword]   = useState<string | null>(null)
  const [email, setEmail]         = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [visible, setVisible]     = useState(false)
  const [copied, setCopied]       = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toast = useToast()

  async function reveal() {
    if (password) { setVisible(v => !v); return }
    setLoading(true)
    try {
      const data = await api.get<{ password: string; email: string | null }>(`/api/credentials/${credId}/reveal`)
      setPassword(data.password)
      setEmail(data.email)
      setVisible(true)
      // Auto-hide after 15 seconds
      timerRef.current = setTimeout(() => setVisible(false), 15000)
    } catch { toast.error('Error al obtener la contraseña') }
    finally { setLoading(false) }
  }

  function copy() {
    if (!password) return
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <div className="flex items-center gap-1.5">
      <code className={`text-xs font-mono px-2 py-1 rounded min-w-[120px] transition-all ${
        visible && password ? 'bg-slate-100 text-slate-800' : 'bg-slate-100 text-slate-300 select-none'
      }`}>
        {visible && password ? password : '••••••••••••'}
      </code>
      {email && visible && (
        <span className="text-[10px] text-slate-400 hidden sm:block truncate max-w-[120px]" title={email}>
          {email}
        </span>
      )}
      <button
        onClick={reveal}
        disabled={loading}
        title={visible ? 'Ocultar' : 'Ver contraseña'}
        className="p-1 text-slate-400 hover:text-[#17394f] transition-colors disabled:opacity-40"
      >
        {loading ? <span className="text-[10px]">…</span> : visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={copy}
        disabled={!password}
        title="Copiar contraseña"
        className="p-1 text-slate-400 hover:text-[#17394f] transition-colors disabled:opacity-40"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

// ── Add/Edit modal ────────────────────────────────────────────────────────────

interface ModalProps {
  cred: InstagramCredential | null
  clients: Client[]
  onSave: (c: InstagramCredential) => void
  onClose: () => void
}

function CredentialModal({ cred, clients, onSave, onClose }: ModalProps) {
  const isNew = !cred
  const toast = useToast()
  const [clientId,  setClientId]  = useState(cred?.clientId ?? '')
  const [username,  setUsername]  = useState(cred?.username ?? '')
  const [password,  setPassword]  = useState('')
  const [email,     setEmail]     = useState('')
  const [notes,     setNotes]     = useState(cred?.notes ?? '')
  const [showPass,  setShowPass]  = useState(false)
  const [saving,    setSaving]    = useState(false)

  async function handleSave() {
    if (!clientId || !username.trim() || (isNew && !password)) {
      toast.error('Cliente, usuario y contraseña son requeridos'); return
    }
    setSaving(true)
    try {
      const body: Record<string, string> = { clientId, username, notes }
      if (password) body.password = password
      if (email)    body.email    = email

      const saved = isNew
        ? await api.post<InstagramCredential>('/api/credentials', body)
        : await api.patch<InstagramCredential>(`/api/credentials/${cred.id}`, body)
      onSave(saved)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error al guardar') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AtSign className="w-4 h-4 text-pink-500" />
            <h2 className="font-semibold text-slate-900">{isNew ? 'Nueva cuenta' : 'Editar cuenta'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {isNew && (
            <div>
              <label className={LABEL}>Cliente *</label>
              <select className={INPUT} value={clientId} onChange={e => setClientId(e.target.value)}>
                <option value="">Selecciona cliente</option>
                {clients.filter(c => c.socialMedia).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={LABEL}>Usuario de Instagram *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
              <input className={`${INPUT} pl-7`} value={username} onChange={e => setUsername(e.target.value)} placeholder="usuario" />
            </div>
          </div>
          <div>
            <label className={LABEL}>{isNew ? 'Contraseña *' : 'Nueva contraseña (dejar vacío para no cambiar)'}</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className={`${INPUT} pr-10`}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isNew ? '' : '••••••••'}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className={LABEL}>Email asociado (opcional)</label>
            <input type="email" className={INPUT} value={email} onChange={e => setEmail(e.target.value)} placeholder="email@dominio.com" />
          </div>
          <div>
            <label className={LABEL}>Notas</label>
            <textarea className={`${INPUT} resize-none`} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: cuenta principal, gestiona Karla…" />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[#17394f] text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-[#17394f]/90"
          >
            {saving ? 'Guardando…' : isNew ? 'Crear' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

function clientColor(color?: string | null) {
  return color ?? '#17394f'
}

interface Props {
  initialCredentials: InstagramCredential[]
  clients: Client[]
}

export function CredentialsClient({ initialCredentials, clients }: Props) {
  const [creds, setCreds]       = useState(initialCredentials)
  const [search, setSearch]     = useState('')
  const [modal, setModal]       = useState<'new' | InstagramCredential | null>(null)
  const toast   = useToast()
  const confirm = useConfirm()

  // Group by client
  const filtered = creds.filter(c =>
    c.username.toLowerCase().includes(search.toLowerCase()) ||
    c.client.name.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = filtered.reduce<Record<string, { client: InstagramCredential['client']; items: InstagramCredential[] }>>((acc, c) => {
    if (!acc[c.clientId]) acc[c.clientId] = { client: c.client, items: [] }
    acc[c.clientId].items.push(c)
    return acc
  }, {})

  async function handleDelete(cred: InstagramCredential) {
    const ok = await confirm({
      title: 'Eliminar credencial',
      message: `¿Eliminar la cuenta @${cred.username} de ${cred.client.name}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    try {
      await api.delete(`/api/credentials/${cred.id}`)
      setCreds(prev => prev.filter(c => c.id !== cred.id))
      toast.success('Credencial eliminada')
    } catch { toast.error('Error al eliminar') }
  }

  function handleSave(saved: InstagramCredential) {
    setCreds(prev => {
      const exists = prev.find(c => c.id === saved.id)
      return exists ? prev.map(c => c.id === saved.id ? saved : c) : [saved, ...prev]
    })
    setModal(null)
    toast.success(modal === 'new' ? 'Cuenta agregada' : 'Cuenta actualizada')
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por cliente o usuario…"
          className="w-full sm:w-72 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/20"
        />
        <button
          onClick={() => setModal('new')}
          className="flex items-center gap-2 bg-[#17394f] text-white text-sm font-semibold rounded-xl px-4 py-2.5 hover:bg-[#17394f]/90 transition shrink-0"
        >
          <Plus className="w-4 h-4" /> Agregar cuenta
        </button>
      </div>

      {/* Empty state */}
      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-20">
          <KeyRound className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="font-semibold text-slate-500">{search ? 'Sin resultados' : 'Sin cuentas registradas'}</p>
          <p className="text-sm text-slate-400 mt-1">{search ? 'Prueba con otro término.' : 'Agrega la primera cuenta de AtSign.'}</p>
        </div>
      )}

      {/* Groups */}
      {Object.values(grouped).map(({ client, items }) => (
        <div key={client.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* Client header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: clientColor(client.color) }}
            />
            <p className="text-sm font-bold text-slate-800">{client.name}</p>
            <span className="text-[10px] text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full font-semibold">
              {items.length} cuenta{items.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Credential rows */}
          <div className="divide-y divide-slate-50">
            {items.map(c => (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
                {/* Username */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <AtSign className="w-4 h-4 text-pink-400 shrink-0" />
                  <span className="text-sm font-semibold text-slate-800 truncate">@{c.username}</span>
                  {c.notes && (
                    <span className="text-[11px] text-slate-400 italic truncate hidden md:block">— {c.notes}</span>
                  )}
                </div>

                {/* Password reveal */}
                <RevealCell credId={c.id} />

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setModal(c)}
                    title="Editar"
                    className="p-1.5 text-slate-400 hover:text-[#17394f] hover:bg-slate-100 rounded-lg transition"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    title="Eliminar"
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Modals */}
      {modal && (
        <CredentialModal
          cred={modal === 'new' ? null : modal}
          clients={clients}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
