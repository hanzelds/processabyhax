'use client'

import { useRef, useEffect, KeyboardEvent, FormEvent } from 'react'
import { DocBlock } from '@/types'
import { placeCursorAtEnd, placeCursorAtStart } from '../docUtils'

interface Props {
  block: DocBlock
  focused: boolean
  readOnly: boolean
  blockRef: (el: HTMLElement | null) => void
  onUpdate: (html: string) => void
  onEnter: () => void
  onBackspaceEmpty: () => void
  onFocus: () => void
  onArrowUp: () => void
  onArrowDown: () => void
  onSlash: (position: { top: number; left: number }) => void
  onSlashClose: () => void
}

const TAG_MAP = {
  paragraph: 'div',
  heading_1: 'div',
  heading_2: 'div',
  heading_3: 'div',
  callout:   'div',
} as const

const CLASS_MAP: Record<string, string> = {
  paragraph: 'text-slate-800 text-[15px] leading-7',
  heading_1: 'text-slate-900 text-3xl font-bold leading-tight',
  heading_2: 'text-slate-900 text-xl font-semibold leading-snug',
  heading_3: 'text-slate-900 text-base font-semibold leading-snug',
  callout:   'text-slate-800 text-[15px] leading-7',
}

export function TextBlock({ block, focused, readOnly, blockRef, onUpdate, onEnter, onBackspaceEmpty, onFocus, onArrowUp, onArrowDown, onSlash, onSlashClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const html = block.content.html ?? ''

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html) {
      ref.current.innerHTML = html
    }
  }, []) // Only on mount — don't re-sync on every keystroke (that resets cursor)

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
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

  function handleInput(e: FormEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const innerHtml = el.innerHTML
    const text = el.innerText.replace(/\n$/, '')

    onUpdate(innerHtml === '<br>' ? '' : innerHtml)

    if (text === '/' || text.startsWith('/')) {
      const rect = el.getBoundingClientRect()
      onSlash({ top: rect.bottom + 4, left: rect.left })
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
    <div
      ref={el => { ref.current = el as HTMLDivElement; blockRef(el) }}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      onKeyDown={handleKeyDown}
      onInput={handleInput}
      onFocus={onFocus}
      className={`w-full outline-none min-h-[1.5em] empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 empty:before:pointer-events-none ${cls}`}
      data-placeholder={placeholder}
    />
  )
}
