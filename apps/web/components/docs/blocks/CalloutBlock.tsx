'use client'

import { useRef, useEffect, KeyboardEvent, FormEvent, useState } from 'react'
import { DocBlock } from '@/types'

interface Props {
  block: DocBlock
  readOnly: boolean
  blockRef: (el: HTMLElement | null) => void
  onUpdate: (updates: Partial<DocBlock['content']>) => void
  onEnter: () => void
  onBackspaceEmpty: () => void
  onFocus: () => void
}

const QUICK_ICONS = ['💡', '⚠️', '✅', '❌', '📌', '🔥', '💬', '🎯', '📋', '🔑']

export function CalloutBlock({ block, readOnly, blockRef, onUpdate, onEnter, onBackspaceEmpty, onFocus }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [showIcons, setShowIcons] = useState(false)
  const html  = block.content.html  ?? ''
  const icon  = block.content.icon  ?? '💡'

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html
    }
  }, [])

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEnter(); return }
    if (e.key === 'Backspace') {
      const text = editorRef.current?.innerText?.replace(/\n$/, '') ?? ''
      if (!text.trim()) { e.preventDefault(); onBackspaceEmpty() }
    }
  }

  function handleInput(e: FormEvent<HTMLDivElement>) {
    const el = e.currentTarget
    onUpdate({ html: el.innerHTML === '<br>' ? '' : el.innerHTML })
  }

  return (
    <div
      ref={el => blockRef(el as HTMLElement)}
      className="flex gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"
      onFocus={onFocus}
    >
      <div className="relative shrink-0">
        <button
          onClick={() => !readOnly && setShowIcons(s => !s)}
          className="text-xl leading-7 hover:opacity-70 transition-opacity"
          type="button"
        >
          {icon}
        </button>
        {showIcons && (
          <div className="absolute top-8 left-0 z-10 bg-white border border-slate-200 rounded-xl shadow-lg p-2 flex flex-wrap gap-1 w-52">
            {QUICK_ICONS.map(ic => (
              <button
                key={ic}
                onClick={() => { onUpdate({ icon: ic }); setShowIcons(false) }}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-lg"
              >
                {ic}
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        className="flex-1 outline-none text-[15px] leading-7 text-slate-800 min-h-[1.5em] empty:before:content-['Escribe_un_callout...'] empty:before:text-slate-300 empty:before:pointer-events-none"
      />
    </div>
  )
}
