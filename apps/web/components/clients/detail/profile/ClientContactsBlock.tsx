'use client'

import { useState } from 'react'
import { ClientContact } from '@/types'
import { api } from '@/lib/api'

function ContactCard({ contact, onSetPrimary, onDelete, onEdit }: {
  contact: ClientContact
  onSetPrimary: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (c: ClientContact) => void
}) {
  return (
    <div className={`py-3.5 border-b border-slate-100 last:border-0 ${contact.isPrimary ? 'bg-brand-50 -mx-5 px-5 rounded-xl' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-900">{contact.name}</p>
            {contact.isPrimary && <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full font-medium">Principal</span>}
          </div>
          {contact.role && <p className="text-xs text-slate-500 mt-0.5">{contact.role}</p>}
          <div className="flex gap-3 mt-1.5 text-xs">
            {contact.email && <a href={`mailto:${contact.email}`} className="text-brand-600 hover:underline">{contact.email}</a>}
            {contact.phone && <a href={`tel:${contact.phone}`} className="text-slate-600">{contact.phone}</a>}
          </div>
          {contact.notes && <p className="text-xs text-slate-400 mt-1 italic">{contact.notes}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 text-xs">
          {!contact.isPrimary && (
            <button onClick={() => onSetPrimary(contact.id)} className="text-brand-600 hover:text-brand-700 font-medium transition-colors">Principal</button>
          )}
          <button onClick={() => onEdit(contact)} className="text-slate-400 hover:text-slate-600 transition-colors">✏</button>
          {!contact.isPrimary && (
            <button onClick={() => onDelete(contact.id)} className="text-slate-300 hover:text-red-400 transition-colors">✕</button>
          )}
        </div>
      </div>
    </div>
  )
}

function ContactForm({ initial, onSave, onCancel }: { initial?: ClientContact; onSave: (data: Partial<ClientContact> & { isPrimary?: boolean }) => Promise<void>; onCancel: () => void }) {
  const [name, setName]       = useState(initial?.name ?? '')
  const [role, setRole]       = useState(initial?.role ?? '')
  const [email, setEmail]     = useState(initial?.email ?? '')
  const [phone, setPhone]     = useState(initial?.phone ?? '')
  const [notes, setNotes]     = useState(initial?.notes ?? '')
  const [isPrimary, setIsPrimary] = useState(initial?.isPrimary ?? false)
  const [saving, setSaving]   = useState(false)

  async function submit() {
    if (!name || (!email && !phone)) return
    setSaving(true)
    try { await onSave({ name, role: role || undefined, email: email || undefined, phone: phone || undefined, notes: notes || undefined, isPrimary }) }
    finally { setSaving(false) }
  }

  return (
    <div className="p-3 bg-slate-50 rounded-xl space-y-2 mb-3">
      <input placeholder="Nombre *" value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
      <input placeholder="Cargo / rol" value={role} onChange={e => setRole(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
      <div className="grid grid-cols-2 gap-2">
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        <input placeholder="Teléfono" value={phone} onChange={e => setPhone(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </div>
      <input placeholder="Nota breve (ej. disponible lunes–viernes)" value={notes} onChange={e => setNotes(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
      {!initial && (
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} className="rounded" />
          Marcar como contacto principal
        </label>
      )}
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving || !name || (!email && !phone)} className="flex-1 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-60" style={{ background: '#17394f' }}>
          {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Agregar contacto'}
        </button>
        <button onClick={onCancel} className="flex-1 py-1.5 text-sm text-slate-600 rounded-lg bg-slate-200 hover:bg-slate-300">Cancelar</button>
      </div>
    </div>
  )
}

interface Props { clientId: string; initialContacts: ClientContact[] }

export function ClientContactsBlock({ clientId, initialContacts }: Props) {
  const [contacts, setContacts] = useState(initialContacts)
  const [showAdd, setShowAdd]   = useState(false)
  const [editing, setEditing]   = useState<ClientContact | null>(null)

  async function addContact(data: Partial<ClientContact> & { isPrimary?: boolean }) {
    const contact = await api.post<ClientContact>(`/api/clients/${clientId}/contacts`, data)
    const enriched = await api.get<ClientContact[]>(`/api/clients/${clientId}/contacts`)
    setContacts(enriched)
    setShowAdd(false)
  }

  async function saveEdit(data: Partial<ClientContact>) {
    if (!editing) return
    const updated = await api.put<ClientContact>(`/api/clients/${clientId}/contacts/${editing.id}`, data)
    setContacts(prev => prev.map(c => c.id === updated.id ? updated : c))
    setEditing(null)
  }

  async function setPrimary(id: string) {
    await api.patch(`/api/clients/${clientId}/contacts/${id}/set-primary`, {})
    const enriched = await api.get<ClientContact[]>(`/api/clients/${clientId}/contacts`)
    setContacts(enriched)
  }

  async function deleteContact(id: string) {
    await api.delete(`/api/clients/${clientId}/contacts/${id}`)
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Contactos</h3>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className="text-xs font-medium px-2.5 py-1 rounded-lg text-white transition-colors" style={{ background: '#17394f' }}>+ Agregar</button>
        )}
      </div>

      {showAdd && <ContactForm onSave={addContact} onCancel={() => setShowAdd(false)} />}

      {contacts.length === 0 && !showAdd
        ? <p className="text-sm text-slate-400 py-4 text-center">Sin contactos registrados</p>
        : contacts.map(c => (
          editing?.id === c.id
            ? <ContactForm key={c.id} initial={c} onSave={saveEdit} onCancel={() => setEditing(null)} />
            : <ContactCard key={c.id} contact={c} onSetPrimary={setPrimary} onDelete={deleteContact} onEdit={setEditing} />
        ))
      }
    </div>
  )
}
