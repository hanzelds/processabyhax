'use client'

import { useState, useRef, useEffect } from 'react'
import { User } from '@/types'
import { Send, Loader2 } from 'lucide-react'

interface Props {
  placeholder?: string
  submitLabel?: string
  onSubmit: (content: string) => Promise<void>
  onCancel?: () => void
  autoFocus?: boolean
  teamUsers: Pick<User, 'id' | 'name'>[]
}

export function CommentForm({ placeholder = 'Escribe un comentario… usa @ para mencionar', submitLabel = 'Comentar', onSubmit, onCancel, autoFocus, teamUsers }: Props) {
  const [content, setContent] = useState('')
  const [saving, setSaving]   = useState(false)
  const [mentionSearch, setMentionSearch] = useState<string | null>(null)
  const [mentionPos, setMentionPos]       = useState({ top: 0, left: 0 })
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }, [content])

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus()
  }, [autoFocus])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setContent(val)

    // Detect @ mention trigger
    const cursor = e.target.selectionStart ?? val.length
    const before = val.slice(0, cursor)
    const match  = before.match(/@([\wáéíóúñÁÉÍÓÚÑ\s]*)$/)

    if (match) {
      setMentionSearch(match[1])
      // Position dropdown near caret (simplified)
      setMentionPos({ top: -8, left: 0 })
    } else {
      setMentionSearch(null)
    }
  }

  function insertMention(user: Pick<User, 'id' | 'name'>) {
    const cursor = textareaRef.current?.selectionStart ?? content.length
    const before = content.slice(0, cursor)
    const after  = content.slice(cursor)
    // Replace partial @mention with full @Name
    const replaced = before.replace(/@[\wáéíóúñÁÉÍÓÚÑ\s]*$/, `@${user.name} `)
    setContent(replaced + after)
    setMentionSearch(null)
    setTimeout(() => {
      textareaRef.current?.focus()
      const pos = replaced.length
      textareaRef.current?.setSelectionRange(pos, pos)
    }, 0)
  }

  async function handleSubmit() {
    if (!content.trim() || saving) return
    setSaving(true)
    try {
      await onSubmit(content.trim())
      setContent('')
    } finally { setSaving(false) }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setMentionSearch(null)
      onCancel?.()
    }
  }

  const filteredUsers = mentionSearch !== null
    ? teamUsers.filter(u => u.name.toLowerCase().includes(mentionSearch.toLowerCase())).slice(0, 6)
    : []

  return (
    <div className="relative">
      <div className="border border-slate-200 rounded-xl focus-within:border-[#17394f]/40 focus-within:ring-2 focus-within:ring-[#17394f]/10 transition-all bg-white">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          className="w-full resize-none px-3 pt-3 pb-2 text-sm text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none leading-relaxed"
        />
        <div className="flex items-center justify-between px-3 pb-2">
          <p className="text-[10px] text-slate-300">⌘↵ para enviar · @ para mencionar</p>
          <div className="flex items-center gap-2">
            {onCancel && (
              <button onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1">
                Cancelar
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={!content.trim() || saving}
              className="flex items-center gap-1.5 bg-[#17394f] text-white text-xs font-medium rounded-lg px-3 py-1.5 disabled:opacity-40 hover:bg-[#17394f]/90 transition-colors"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {submitLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Mention dropdown */}
      {mentionSearch !== null && filteredUsers.length > 0 && (
        <div
          className="absolute z-50 bottom-full mb-1 left-0 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[200px]"
        >
          {filteredUsers.map(u => (
            <button
              key={u.id}
              onMouseDown={e => { e.preventDefault(); insertMention(u) }}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <span className="w-6 h-6 rounded-full bg-[#17394f]/10 flex items-center justify-center text-[10px] font-bold text-[#17394f] shrink-0">
                {u.name.charAt(0).toUpperCase()}
              </span>
              {u.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
