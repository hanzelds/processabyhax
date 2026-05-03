'use client'

import { useState, useRef } from 'react'
import { User, Skill, Role } from '@/types'
import { USER_ROLE_LABEL, USER_STATUS_LABEL, USER_STATUS_COLOR, formatDate } from '@/lib/utils'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

const AREAS = [
  'Diseño gráfico', 'Dirección de arte', 'Motion & video', 'Fotografía',
  'Copywriting', 'Estrategia de contenido', 'Community management',
  'Desarrollo web', 'Producción', 'Account management', 'Dirección',
]

interface Props {
  user: User
  skills: Skill[]
  isAdmin: boolean
  isOwnProfile: boolean
  onUpdate: (u: User) => void
}

export function UserProfileTab({ user: initialUser, skills: initialSkills, isAdmin, isOwnProfile, onUpdate }: Props) {
  const toast   = useToast()
  const [user, setUser]     = useState(initialUser)
  const [skills, setSkills] = useState(initialSkills)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [skillInput, setSkillInput] = useState('')
  const [skillSuggestions, setSkillSuggestions] = useState<Skill[]>([])
  const [allSkills, setAllSkills] = useState<Skill[]>([])

  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Edit form state
  const [form, setForm] = useState({
    name:     user.name,
    email:    user.email,
    bio:      user.bio ?? '',
    phone:    user.phone ?? '',
    area:     user.area ?? '',
    role:     user.role as Role,
    joinedAt: user.joinedAt ? user.joinedAt.substring(0, 10) : '',
  })

  async function saveProfile() {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        bio:   form.bio   || null,
        phone: form.phone || null,
      }
      if (isAdmin) {
        payload.name     = form.name
        payload.email    = form.email
        payload.area     = form.area || null
        payload.newRole  = form.role
        payload.joinedAt = form.joinedAt || null
      }
      const updated = await api.patch<User>(`/api/users/${user.id}`, payload)
      setUser(updated)
      onUpdate(updated)
      setEditing(false)
      router.refresh()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error al guardar') }
    finally { setSaving(false) }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('avatar', file)
    try {
      const res = await fetch(`/api/users/${user.id}/avatar`, { method: 'POST', body: formData, credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUser(u => ({ ...u, avatarUrl: data.avatarUrl }))
      onUpdate({ ...user, avatarUrl: data.avatarUrl })
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error al subir avatar') }
  }

  async function loadSkillSuggestions(q: string) {
    if (!allSkills.length) {
      const all = await api.get<Skill[]>('/api/users/skills/all')
      setAllSkills(all)
      setSkillSuggestions(all.filter(s => s.name.includes(q.toLowerCase()) && !skills.find(sk => sk.id === s.id)))
    } else {
      setSkillSuggestions(allSkills.filter(s => s.name.includes(q.toLowerCase()) && !skills.find(sk => sk.id === s.id)))
    }
  }

  async function addSkill(name: string) {
    if (!name.trim()) return
    const updated = await api.post<Skill[]>(`/api/users/${user.id}/skills`, { name: name.trim() })
    setSkills(updated)
    setSkillInput('')
    setSkillSuggestions([])
  }

  async function removeSkill(skillId: string) {
    await api.delete(`/api/users/${user.id}/skills/${skillId}`)
    setSkills(s => s.filter(sk => sk.id !== skillId))
  }

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left col */}
      <div className="space-y-4">
        {/* Avatar + identity */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-start gap-4 mb-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center">
                  <span className="text-brand-700 text-xl font-semibold">{initials}</span>
                </div>
              )}
              {(isAdmin || isOwnProfile) && (
                <>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-brand-700 rounded-full flex items-center justify-center text-white text-xs hover:bg-brand-800"
                    title="Cambiar foto"
                  >✎</button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </>
              )}
            </div>

            <div className="flex-1">
              {editing ? (
                <input
                  disabled={!isAdmin}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="text-lg font-semibold text-slate-900 w-full border-b border-slate-300 focus:outline-none focus:border-brand-500 bg-transparent mb-1"
                />
              ) : (
                <h3 className="text-lg font-semibold text-slate-900">{user.name}</h3>
              )}
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${USER_STATUS_COLOR[user.status]}`}>
                  {USER_STATUS_LABEL[user.status]}
                </span>
                <span className="text-xs text-slate-500">{USER_ROLE_LABEL[user.role]}</span>
                {user.area && <span className="text-xs text-slate-400">· {user.area}</span>}
              </div>
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            {editing && isAdmin && (
              <div>
                <label className="text-xs text-slate-500 block mb-1">Email</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
            )}

            <div>
              <label className="text-xs text-slate-500 block mb-1">Bio</label>
              {editing && (isAdmin || isOwnProfile) ? (
                <textarea maxLength={150} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" rows={2} />
              ) : (
                <p className="text-sm text-slate-600">{user.bio || <span className="text-slate-400">—</span>}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Teléfono</label>
                {editing && (isAdmin || isOwnProfile) ? (
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                ) : (
                  <p className="text-sm text-slate-600">{user.phone || <span className="text-slate-400">—</span>}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Área</label>
                {editing && isAdmin ? (
                  <select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                    <option value="">— Sin área —</option>
                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-slate-600">{user.area || <span className="text-slate-400">—</span>}</p>
                )}
              </div>
            </div>

            {isAdmin && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Rol</label>
                  {editing ? (
                    <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                      <option value="ADMIN">Admin</option>
                      <option value="LEAD">Lead</option>
                      <option value="TEAM">Team</option>
                    </select>
                  ) : (
                    <p className="text-sm text-slate-600">{USER_ROLE_LABEL[user.role]}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">En Hax desde</label>
                  {editing ? (
                    <input type="date" value={form.joinedAt} onChange={e => setForm(f => ({ ...f, joinedAt: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  ) : (
                    <p className="text-sm text-slate-600">{formatDate(user.joinedAt)}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {(isAdmin || isOwnProfile) && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
              {editing ? (
                <>
                  <button onClick={() => setEditing(false)} className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm rounded-lg py-1.5">Cancelar</button>
                  <button onClick={saveProfile} disabled={saving} className="flex-1 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-sm rounded-lg py-1.5">
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)} className="text-sm text-brand-700 hover:text-brand-800 font-medium">Editar perfil</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right col: skills */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h4 className="text-sm font-semibold text-slate-700 mb-4">Habilidades</h4>
        <div className="flex flex-wrap gap-2 mb-3">
          {skills.map(s => (
            <span key={s.id} className="flex items-center gap-1 text-xs bg-brand-50 text-brand-700 px-2.5 py-1 rounded-full">
              {s.name}
              {(isAdmin || isOwnProfile) && (
                <button onClick={() => removeSkill(s.id)} className="text-brand-400 hover:text-brand-700 ml-0.5">×</button>
              )}
            </span>
          ))}
          {skills.length === 0 && <p className="text-sm text-slate-400">Sin habilidades registradas</p>}
        </div>
        {(isAdmin || isOwnProfile) && (
          <div className="relative">
            <input
              value={skillInput}
              onChange={e => { setSkillInput(e.target.value); loadSkillSuggestions(e.target.value) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput) } }}
              placeholder="Agregar habilidad..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            {skillSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 z-10 max-h-40 overflow-y-auto">
                {skillSuggestions.map(s => (
                  <button key={s.id} onClick={() => addSkill(s.name)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-700">
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info block */}
        <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Email</span>
            <span className="text-slate-700">{user.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Miembro desde</span>
            <span className="text-slate-700">{formatDate(user.createdAt)}</span>
          </div>
          {user.lastSeenAt && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Último acceso</span>
              <span className="text-slate-700">{new Date(user.lastSeenAt).toLocaleString('es-DO')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
