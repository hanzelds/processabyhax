'use client'

import { useRef, KeyboardEvent } from 'react'
import { DocBlock } from '@/types'

const LANGUAGES = ['javascript', 'typescript', 'python', 'bash', 'sql', 'json', 'css', 'html', 'markdown', 'text']

interface Props {
  block: DocBlock
  readOnly: boolean
  blockRef: (el: HTMLElement | null) => void
  onUpdate: (updates: Partial<DocBlock['content']>) => void
  onEnter: () => void
  onFocus: () => void
}

export function CodeBlock({ block, readOnly, blockRef, onUpdate, onEnter, onFocus }: Props) {
  const text     = block.content.text     ?? ''
  const language = block.content.language ?? 'javascript'
  const taRef = useRef<HTMLTextAreaElement>(null)

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = e.currentTarget
      const start = el.selectionStart
      const end   = el.selectionEnd
      const next  = text.slice(0, start) + '  ' + text.slice(end)
      onUpdate({ text: next })
      setTimeout(() => { if (taRef.current) { taRef.current.selectionStart = taRef.current.selectionEnd = start + 2 } }, 0)
    }
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  return (
    <div ref={el => blockRef(el as HTMLElement)} className="rounded-xl overflow-hidden border border-slate-200" onFocus={onFocus}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800">
        <select
          value={language}
          onChange={e => onUpdate({ language: e.target.value })}
          disabled={readOnly}
          className="bg-transparent text-slate-400 text-xs border-0 outline-none cursor-pointer hover:text-white transition-colors"
        >
          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <button
          onClick={() => navigator.clipboard.writeText(text).catch(() => {})}
          className="text-slate-400 hover:text-white text-xs transition-colors"
        >
          Copiar
        </button>
      </div>
      {/* Code area */}
      <div className="bg-slate-900 px-4 py-3">
        <textarea
          ref={taRef}
          value={text}
          readOnly={readOnly}
          onChange={e => { onUpdate({ text: e.target.value }); autoResize(e.target) }}
          onKeyDown={handleKeyDown}
          rows={Math.max(3, text.split('\n').length)}
          className="w-full bg-transparent text-slate-100 font-mono text-sm leading-6 outline-none resize-none min-h-[60px]"
          placeholder="// Código aquí..."
          spellCheck={false}
        />
      </div>
    </div>
  )
}
