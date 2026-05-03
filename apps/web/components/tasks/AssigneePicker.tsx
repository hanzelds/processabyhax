'use client'

import { User } from '@/types'
import { X } from 'lucide-react'

interface Props {
  users: User[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  className?: string
}

const INPUT_CLS = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/30 focus:border-[#17394f]/50 transition-colors'

export function AssigneePicker({ users, selectedIds, onChange, className }: Props) {
  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const selectedUsers = users.filter(u => selectedIds.includes(u.id))

  return (
    <div className={className}>
      {/* Selected chips */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedUsers.map(u => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1 text-xs bg-[#17394f]/10 text-[#17394f] px-2 py-0.5 rounded-full"
            >
              {u.name.split(' ')[0]}
              <button
                type="button"
                onClick={() => toggle(u.id)}
                className="hover:text-[#17394f]/60 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown to add */}
      <select
        className={INPUT_CLS}
        value=""
        onChange={e => { if (e.target.value) toggle(e.target.value) }}
      >
        <option value="">
          {selectedIds.length === 0 ? 'Asignar miembro…' : 'Agregar otro miembro…'}
        </option>
        {users
          .filter(u => !selectedIds.includes(u.id))
          .map(u => (
            <option key={u.id} value={u.id}>
              {u.name}{u.area ? ` · ${u.area}` : ''}
            </option>
          ))}
      </select>
    </div>
  )
}
