'use client'

import { useRef, useEffect, useState, KeyboardEvent, FormEvent } from 'react'
import { DocBlock, User } from '@/types'
import { placeCursorAtEnd, placeCursorAtStart } from '../docUtils'

interface Props {
  block: DocBlock
  focused: boolean
  readOnly: boolean
  users?: User[]
  blockRef: (el: HTMLElement | null) => void
  onUpdate: (html: string) => void
  onEnter: () => void
  onBackspaceEmpty: () => void
  onFocus: () => void
  onArrowUp: () => void
  onArrowDown: () => void
  onSlash: (position: { top: number; left: number }, filter: string) => void
  onSlashClose: () => void
}

const CLASS_MAP: Record<string, string> = {
  paragraph: 'text-slate-800 text-[15px] leading-7',
  heading_1: 'text-slate-900 text-3xl font-bold leading-tight',
  heading_2: 'text-slate-900 text-xl font-semibold leading-snug',
  heading_3: 'text-slate-900 text-base font-semibold leading-snug',
  callout:   'text-slate-800 text-[15px] leading-7',
}

// Normalize accented chars for case-insensitive prefix matching
function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function TextBlock({ block, focused, readOnly, users = [], blockRef, onUpdate, onEnter, onBackspaceEmpty, onFocus, onArrowUp, onArrowDown, onSlash, onSlashClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const html = block.content.html ?? ''

  // Mention dropdown state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionPos, setMentionPos]     = useState({ top: 0, left: 0 })
  const [mentionIdx, setMentionIdx]     = useState(0)

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html) {
      ref.current.innerHTML = html
    }
  }, []) // Only on mount — don't re-sync on every keystroke (that resets cursor)

  // Filtered user list for the dropdown
  const filteredUsers = mentionQuery !== null
    ? users.filter(u => norm(u.name).startsWith(norm(mentionQuery))).slice(0, 6)
    : []

  // Get the @query text immediately before the cursor (if any)
  function getMentionQuery(): string | null {
    const sel = window.getSelection()
    if (!sel?.rangeCount) return null
    const range = sel.getRangeAt(0)
    if (!range.collapsed) return null
    const node = range.startContainer
    if (node.nodeType !== Node.TEXT_NODE) return null
    const text = (node.textContent ?? '').slice(0, range.startOffset)
    const match = text.match(/@([\wáéíóúñÁÉÍÓÚÑ]*)$/)
    return match ? match[1] : null
  }

  // Insert a mention span at the current cursor position
  function insertMention(user: User) {
    const sel = window.getSelection()
    if (!sel?.rangeCount) return
    const range  = sel.getRangeAt(0)
    const node   = range.startContainer as Text
    const text   = node.textContent ?? ''
    const offset = range.startOffset
    const atStart = text.lastIndexOf('@', offset - 1)
    if (atStart === -1) return

    const span = document.createElement('span')
    span.className = 'doc-mention'
    span.setAttribute('data-user-id', user.id)
    span.setAttribute('contenteditable', 'false')
    span.textContent = `@${user.name}`

    const space     = document.createTextNode(' ')
    const afterNode = document.createTextNode(text.slice(offset))
    node.textContent = text.slice(0, atStart)
    node.after(span, space, afterNode)

    // Move cursor after the space
    const newRange = document.createRange()
    newRange.setStart(afterNode, 0)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)

    if (ref.current) onUpdate(ref.current.innerHTML)
    setMentionQuery(null)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // Handle mention dropdown navigation first
    if (mentionQuery !== null) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIdx(i => Math.min(i + 1, filteredUsers.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIdx(i => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' && filteredUsers[mentionIdx]) {
        e.preventDefault()
        insertMention(filteredUsers[mentionIdx])
        return
      }
      if (e.key === 'Escape') {
        setMentionQuery(null)
        return
      }
    }

    // Formatting shortcuts
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      if (e.key === 'b') { e.preventDefault(); document.execCommand('bold',          false); return }
      if (e.key === 'i') { e.preventDefault(); document.execCommand('italic',        false); return }
      if (e.key === 'u') { e.preventDefault(); document.execCommand('underline',     false); return }
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
      if (e.key === 'X' || e.key === 'x') { e.preventDefault(); document.execCommand('strikeThrough', false); return }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onEnter()
      return
    }
    if (e.key === 'Backspace') {
      const text = ref.current?.innerText?.replace(/\n$/, '') ?? ''
      const innerHtml = ref.current?.innerHTML ?? ''
      if (!text.trim() || innerHtml === '<br>') {
        e.preventDefault()
        onBackspaceEmpty()
      }
      return
    }
    if (e.key === 'ArrowUp') {
      const sel = window.getSelection()
      if (sel?.rangeCount) {
        const range = sel.getRangeAt(0)
        const start = range.startOffset
        if (start === 0 || ref.current?.innerText === '') {
          e.preventDefault(); onArrowUp()
        }
      }
      return
    }
    if (e.key === 'ArrowDown') {
      const sel = window.getSelection()
      if (sel?.rangeCount && ref.current) {
        const range = sel.getRangeAt(0)
        const textLen = ref.current.innerText.length
        if (range.endOffset >= textLen || ref.current.innerText === '') {
          e.preventDefault(); onArrowDown()
        }
      }
      return
    }
    if (e.key === 'Escape') {
      onSlashClose()
    }
  }

  function handleKeyUp() {
    const q = getMentionQuery()
    if (q !== null) {
      // Position dropdown below the cursor
      const sel = window.getSelection()
      if (sel?.rangeCount && ref.current) {
        const rect    = sel.getRangeAt(0).getBoundingClientRect()
        const base    = ref.current.getBoundingClientRect()
        setMentionPos({ top: rect.bottom - base.top + 4, left: Math.max(0, rect.left - base.left) })
      }
      setMentionQuery(q)
      setMentionIdx(0)
    } else {
      setMentionQuery(null)
    }
  }

  function handleInput(e: FormEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const innerHtml = el.innerHTML
    const text = el.innerText.replace(/\n$/, '')

    onUpdate(innerHtml === '<br>' ? '' : innerHtml)

    if (text === '/' || text.startsWith('/')) {
      const rect = el.getBoundingClientRect()
      const filter = text.startsWith('/') ? text.slice(1) : ''
      onSlash({ top: rect.bottom + 4, left: rect.left }, filter)
    } else {
      onSlashClose()
    }
  }

  const cls = CLASS_MAP[block.type] ?? CLASS_MAP.paragraph
  const placeholder = block.type === 'paragraph' ? 'Escribe algo o usa / para comandos'
    : block.type === 'heading_1' ? 'Título 1'
    : block.type === 'heading_2' ? 'Título 2'
    : block.type === 'heading_3' ? 'Título 3'
    : 'Escribe...'

  return (
    <div className="relative">
      <div
        ref={el => { ref.current = el as HTMLDivElement; blockRef(el) }}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onInput={handleInput}
        onFocus={onFocus}
        onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
        className={`w-full outline-none min-h-[1.5em] empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 empty:before:pointer-events-none ${cls}`}
        data-placeholder={placeholder}
      />

      {/* @Mention dropdown */}
      {mentionQuery !== null && filteredUsers.length > 0 && (
        <ul
          className="absolute z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1 min-w-[200px] max-w-[280px]"
          style={{ top: mentionPos.top, left: mentionPos.left }}
        >
          {filteredUsers.map((user, i) => (
            <li key={user.id}>
              <button
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors ${
                  i === mentionIdx ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
                onMouseDown={e => { e.preventDefault(); insertMention(user) }}
              >
                <span className="w-7 h-7 rounded-full bg-[#17394f] text-white text-xs flex items-center justify-center shrink-0 font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="font-medium text-slate-800 truncate">{user.name}</span>
                {user.area && (
                  <span className="text-slate-400 text-xs shrink-0 ml-auto">{user.area}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
