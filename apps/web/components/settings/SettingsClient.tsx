'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { User, UserSession } from '@/types'
import { api, apiFetch } from '@/lib/api'
import {
  User as UserIcon, Lock, Monitor, MessageCircle,
  Camera, CheckCircle, AlertCircle, Loader2,
  Laptop, Smartphone, Globe, Trash2, ShieldOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Shared ────────────────────────────────────────────────────────────────────

type Tab = 'perfil' | 'password' | 'sesiones'

const TABS: { id: Tab; label: string; Icon: typeof UserIcon }[] = [
  { id: 'perfil',   label: 'Perfil',    Icon: UserIcon  },
  { id: 'password', label: 'Contraseña', Icon: Lock      },
  { id: 'sesiones', label: 'Sesiones',  Icon: Monitor   },
]

const INPUT = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/30 focus:border-[#17394f]/50 transition-colors bg-white disabled:bg-slate-50 disabled:text-slate-400'

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl',
      ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
    )}>
      {ok
        ? <CheckCircle className="w-4 h-4 shrink-0" />
        : <AlertCircle className="w-4 h-4 shrink-0" />}
      {msg}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function AvatarBlock({ user, onUpdate }: { user: User; onUpdate: (u: User) => void }) {
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setErr('')
    const form = new FormData()
    form.append('avatar', file)
    try {
      const res = await fetch(`/api/users/${user.id}/avatar`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      if (!res.ok) { const d = await res.json(); setErr(d.error || 'Error'); return }
      const data = await res.json()
      onUpdate({ ...user, avatarUrl: data.avatarUrl })
    } catch { setErr('Error al subir imagen') }
    finally { setUploading(false); if (ref.current) ref.current.value = '' }
  }

  const initials = user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold text-lg overflow-hidden"
          style={{ backgroundColor: '#17394f' }}
        >
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            : initials}
        </div>
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        )}
      </div>
      <div>
        <button
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-sm font-medium text-[#17394f] border border-[#17394f]/30 rounded-lg px-3 py-1.5 hover:bg-[#17394f]/5 transition-colors disabled:opacity-50"
        >
          <Camera className="w-3.5 h-3.5" />
          {uploading ? 'Subiendo…' : 'Cambiar foto'}
        </button>
        <p className="text-xs text-slate-400 mt-1">JPG, PNG o WEBP · máx. 2 MB</p>
        {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
    </div>
  )
}

// ── Toggle helper (local) ─────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void
  label: string; description?: string
}) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer group py-2">
      <div>
        <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-[#17394f]' : 'bg-slate-200'
        )}
        style={{ height: '22px', width: '40px' }}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-[18px]' : 'translate-x-0'
          )}
          style={{ width: '18px', height: '18px' }}
        />
      </button>
    </label>
  )
}

// ── Perfil Tab ────────────────────────────────────────────────────────────────

function PerfilTab({ user, onUpdate }: { user: User; onUpdate: (u: User) => void }) {
  const [name,           setName]           = useState(user.name)
  const [bio,            setBio]            = useState(user.bio ?? '')
  const [phone,          setPhone]          = useState(user.phone ?? '')
  const [whatsappNotif,  setWhatsappNotif]  = useState(user.whatsappNotif ?? true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState<{ msg: string; ok: boolean } | null>(null)

  function flash(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const updated = await api.patch<User>(`/api/users/${user.id}`, { name, bio, phone, whatsappNotif })
      onUpdate(updated)
      flash('Perfil actualizado', true)
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Error al guardar', false)
    } finally { setSaving(false) }
  }

  const ROLE_LABEL: Record<string, string> = {
    ADMIN: 'Administrador', LEAD: 'Lead', TEAM: 'Team',
  }

  return (
    <div className="space-y-4">
      <Section title="Foto de perfil">
        <AvatarBlock user={user} onUpdate={onUpdate} />
      </Section>

      <Section title="Información personal">
        <Field label="Nombre completo">
          <input className={INPUT} value={name} onChange={e => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rol">
            <input className={INPUT} value={ROLE_LABEL[user.role] ?? user.role} disabled />
          </Field>
          <Field label="Área">
            <input className={INPUT} value={user.area ?? '—'} disabled />
          </Field>
        </div>
        <Field label="Email">
          <input className={INPUT} value={user.email} disabled />
        </Field>
        <Field label="Teléfono">
          <input
            className={INPUT}
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+1 809 000 0000"
          />
        </Field>
        <Field label="Bio">
          <textarea
            className={`${INPUT} resize-none`}
            rows={3}
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Cuéntanos algo sobre ti…"
          />
        </Field>
      </Section>

      <Section title="Notificaciones">
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2 mb-1">
          <MessageCircle className="w-4 h-4 shrink-0 text-green-500" />
          Configura cómo recibes alertas. Requiere número de teléfono en formato internacional.
        </div>
        <div className="divide-y divide-slate-100">
          <Toggle
            checked={whatsappNotif}
            onChange={setWhatsappNotif}
            label="Notificaciones por WhatsApp"
            description="Recibe avisos de tareas asignadas, cambios de estado y recordatorios de vencimiento"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          {toast ? <Toast msg={toast.msg} ok={toast.ok} /> : <div />}
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 bg-[#17394f] hover:bg-[#17394f]/90 disabled:opacity-50 text-white text-sm font-medium rounded-xl px-4 py-2.5 transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </Section>

    </div>
  )
}

// ── Contraseña Tab ────────────────────────────────────────────────────────────

function PasswordTab({ user }: { user: User }) {
  const [current,  setCurrent]  = useState('')
  const [next,     setNext]     = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null)

  function flash(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const mismatch = next && confirm && next !== confirm
  const weak     = next && next.length < 6

  async function save() {
    if (!current || !next || next !== confirm || next.length < 6) return
    setSaving(true)
    try {
      await api.put(`/api/users/${user.id}/password`, {
        currentPassword: current,
        newPassword: next,
      })
      flash('Contraseña actualizada. Las otras sesiones han sido cerradas.', true)
      setCurrent(''); setNext(''); setConfirm('')
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Error al cambiar contraseña', false)
    } finally { setSaving(false) }
  }

  return (
    <Section title="Cambiar contraseña">
      <Field label="Contraseña actual">
        <input
          type="password"
          className={INPUT}
          value={current}
          onChange={e => setCurrent(e.target.value)}
          autoComplete="current-password"
        />
      </Field>
      <Field label="Nueva contraseña">
        <input
          type="password"
          className={cn(INPUT, weak ? 'border-amber-300 focus:border-amber-400' : '')}
          value={next}
          onChange={e => setNext(e.target.value)}
          autoComplete="new-password"
        />
        {weak && <p className="text-xs text-amber-500 mt-1">Mínimo 6 caracteres</p>}
      </Field>
      <Field label="Confirmar nueva contraseña">
        <input
          type="password"
          className={cn(INPUT, mismatch ? 'border-red-300 focus:border-red-400' : '')}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
        {mismatch && <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>}
      </Field>

      <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-0.5">
        <p>Al cambiar tu contraseña:</p>
        <p>• Se cerrarán todas tus otras sesiones activas</p>
        <p>• Deberás iniciar sesión de nuevo en otros dispositivos</p>
      </div>

      <div className="flex items-center justify-between pt-1">
        {toast ? <Toast msg={toast.msg} ok={toast.ok} /> : <div />}
        <button
          onClick={save}
          disabled={saving || !current || !next || !!mismatch || !!weak}
          className="flex items-center gap-2 bg-[#17394f] hover:bg-[#17394f]/90 disabled:opacity-50 text-white text-sm font-medium rounded-xl px-4 py-2.5 transition-colors"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Actualizando…' : 'Cambiar contraseña'}
        </button>
      </div>
    </Section>
  )
}

// ── Sesiones Tab ──────────────────────────────────────────────────────────────

function DeviceIcon({ info }: { info?: string | null }) {
  const s = (info ?? '').toLowerCase()
  if (s.includes('mobile') || s.includes('android') || s.includes('iphone'))
    return <Smartphone className="w-4 h-4 text-slate-400" />
  if (s.includes('mozilla') || s.includes('chrome') || s.includes('safari'))
    return <Globe className="w-4 h-4 text-slate-400" />
  return <Laptop className="w-4 h-4 text-slate-400" />
}

function SessionsTab({ user, initialSessions }: { user: User; initialSessions: UserSession[] }) {
  const router = useRouter()
  const [sessions, setSessions] = useState(initialSessions)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [revokingAll, setRevokingAll] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function flash(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function revokeOne(id: string) {
    setRevoking(id)
    try {
      await api.delete(`/api/users/sessions/${id}`)
      setSessions(prev => prev.filter(s => s.id !== id))
      flash('Sesión cerrada', true)
    } catch { flash('Error al cerrar sesión', false) }
    finally { setRevoking(null) }
  }

  async function revokeAll() {
    setRevokingAll(true)
    try {
      await api.delete(`/api/users/${user.id}/sessions`)
      setSessions(prev => prev.filter(s => s.isCurrentSession))
      flash('Otras sesiones cerradas', true)
    } catch { flash('Error', false) }
    finally { setRevokingAll(false) }
  }

  const others = sessions.filter(s => !s.isCurrentSession)

  return (
    <div className="space-y-4">
      {/* Current session */}
      <Section title="Sesión actual">
        {sessions.filter(s => s.isCurrentSession).map(s => (
          <div key={s.id} className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <DeviceIcon info={s.deviceInfo} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">
                {s.deviceInfo || 'Dispositivo desconocido'}
              </p>
              <p className="text-xs text-slate-500">
                {s.ipAddress && <span className="mr-2">{s.ipAddress}</span>}
                {s.relativeTime}
              </p>
            </div>
            <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">
              Esta sesión
            </span>
          </div>
        ))}
      </Section>

      {/* Other sessions */}
      <Section title={`Otras sesiones activas (${others.length})`}>
        {others.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No hay otras sesiones activas</p>
        ) : (
          <div className="space-y-2">
            {others.map(s => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100"
              >
                <DeviceIcon info={s.deviceInfo} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {s.deviceInfo || 'Dispositivo desconocido'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {s.ipAddress && <span className="mr-2">{s.ipAddress}</span>}
                    {s.relativeTime}
                  </p>
                </div>
                <button
                  onClick={() => revokeOne(s.id)}
                  disabled={revoking === s.id}
                  title="Cerrar sesión"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                >
                  {revoking === s.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}

        {others.length > 0 && (
          <div className="flex items-center justify-between pt-2">
            {toast ? <Toast msg={toast.msg} ok={toast.ok} /> : <div />}
            <button
              onClick={revokeAll}
              disabled={revokingAll}
              className="flex items-center gap-1.5 text-sm font-medium text-red-500 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {revokingAll
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <ShieldOff className="w-4 h-4" />}
              Cerrar todas las demás
            </button>
          </div>
        )}
        {toast && others.length === 0 && (
          <div className="pt-1"><Toast msg={toast.msg} ok={toast.ok} /></div>
        )}
      </Section>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

interface Props {
  user: User
  sessions: UserSession[]
}

export function SettingsClient({ user: initialUser, sessions }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('perfil')
  const [user, setUser] = useState(initialUser)

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 w-fit">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === id
                ? 'bg-white text-[#17394f] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'perfil'   && <PerfilTab    user={user} onUpdate={setUser} />}
      {activeTab === 'password' && <PasswordTab  user={user} />}
      {activeTab === 'sesiones' && <SessionsTab  user={user} initialSessions={sessions} />}
    </div>
  )
}
