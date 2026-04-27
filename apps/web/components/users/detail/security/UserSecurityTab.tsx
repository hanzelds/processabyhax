'use client'

import { useState, useEffect } from 'react'
import { UserSession } from '@/types'
import { api } from '@/lib/api'

interface Props { userId: string; isAdmin: boolean; isOwnProfile: boolean }

export function UserSecurityTab({ userId, isAdmin, isOwnProfile }: Props) {
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)

  // Password change
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass]         = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [passError, setPassError]     = useState('')
  const [passSuccess, setPassSuccess] = useState(false)
  const [savingPass, setSavingPass]   = useState(false)

  useEffect(() => {
    api.get<UserSession[]>(`/api/users/${userId}/sessions`)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoadingSessions(false))
  }, [userId])

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPassError('')
    if (newPass !== confirmPass) { setPassError('Las contraseñas no coinciden'); return }
    if (newPass.length < 6) { setPassError('La nueva contraseña debe tener al menos 6 caracteres'); return }
    setSavingPass(true)
    try {
      await api.put(`/api/users/${userId}/password`, { currentPassword: currentPass, newPassword: newPass })
      setPassSuccess(true)
      setCurrentPass(''); setNewPass(''); setConfirmPass('')
      setTimeout(() => setPassSuccess(false), 3000)
    } catch (e: unknown) {
      setPassError(e instanceof Error ? e.message : 'Error al cambiar contraseña')
    } finally { setSavingPass(false) }
  }

  async function revokeSession(sessionId: string) {
    await api.delete(`/api/users/sessions/${sessionId}`)
    setSessions(s => s.filter(sess => sess.id !== sessionId))
  }

  async function revokeAllOthers() {
    await api.delete(`/api/users/${userId}/sessions`)
    setSessions(s => s.filter(sess => sess.isCurrentSession))
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Change password — only for own profile */}
      {isOwnProfile && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Cambiar contraseña</h4>
          <form onSubmit={changePassword} className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Contraseña actual</label>
              <input type="password" required value={currentPass} onChange={e => setCurrentPass(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Nueva contraseña</label>
              <input type="password" required value={newPass} onChange={e => setNewPass(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Confirmar nueva contraseña</label>
              <input type="password" required value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            {passError && <p className="text-red-500 text-xs">{passError}</p>}
            {passSuccess && <p className="text-emerald-600 text-xs">Contraseña cambiada exitosamente</p>}
            <button type="submit" disabled={savingPass}
              className="bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              {savingPass ? 'Cambiando...' : 'Cambiar contraseña'}
            </button>
          </form>
        </div>
      )}

      {/* Sessions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-slate-700">Sesiones activas</h4>
          {sessions.filter(s => !s.isCurrentSession).length > 0 && (
            <button onClick={revokeAllOthers} className="text-xs text-red-500 hover:text-red-700 font-medium">
              Cerrar otras sesiones
            </button>
          )}
        </div>

        {loadingSessions
          ? <p className="text-sm text-slate-400">Cargando…</p>
          : sessions.length === 0
            ? <p className="text-sm text-slate-400">No hay sesiones activas</p>
            : (
              <div className="space-y-3">
                {sessions.map(s => (
                  <div key={s.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-500 text-sm">
                      {s.deviceInfo?.toLowerCase().includes('mobile') ? '📱' : '💻'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{s.deviceInfo?.substring(0, 60) ?? 'Dispositivo desconocido'}</p>
                      <p className="text-xs text-slate-400">{s.ipAddress ?? '—'} · {s.relativeTime}</p>
                    </div>
                    {s.isCurrentSession
                      ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium shrink-0">Sesión actual</span>
                      : <button onClick={() => revokeSession(s.id)} className="text-xs text-red-500 hover:text-red-700 shrink-0">Cerrar</button>
                    }
                  </div>
                ))}
              </div>
            )
        }
      </div>
    </div>
  )
}
