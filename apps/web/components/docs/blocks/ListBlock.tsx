'use client'

import { useRef, KeyboardEvent } from 'react'
import { DocBlock } from '@/types'

interface Props {
  block: DocBlock
  readOnly: boolean
  blockRef: (el: HTMLElement | null) => void
  onUpdate: (items: string[]) => void
  onEnter: () => void
  onBackspaceEmpty: () => void
  onFocus: () => void
}

export function ListBlock({ block, readOnly, blockRef, onUpdate, onEnter, onBackspaceEmpty, onFocus }: Props) {
  const items = block.content.items ?? ['']
  const isNumbered = block.type === 'numbered_list'
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  function update(index: number, value: string) {
    const next = [...items]
    next[index] = value
    onUpdate(next)
  }

  function addItem(after: number) {
    const next = [...items]
    next.splice(after + 1, 0, '')
    onUpdate(next)
    setTimeout(() => inputRefs.current[after + 1]?.focus(), 30)
  }

  function removeItem(index: number) {
    if (items.length === 1) {
      onBackspaceEmpty(); return
    }
    const next = items.filter((_, i) => i !== index)
    onUpdate(next)
    setTimeout(() => inputRefs.current[Math.max(0, index - 1)]?.focus(), 30)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (items[index].trim() === '' && index === items.length - 1) {
        onEnter(); return
      }
      addItem(index)
      return
    }
    if (e.key === 'Backspace' && !items[index]) {
      e.preventDefault()
      removeItem(index)
    }
  }

  const Tag = isNumbered ? 'ol' : 'ul'

  return (
    <Tag
      ref={el => blockRef(el as HTMLElement)}
      className={`pl-5 space-y-0.5 ${isNumbered ? 'list-decimal' : 'list-disc'}`}
      onFocus={onFocus}
    >
      {items.map((item, i) => (
        <li key={i} className="text-slate-800 text-[15px] leading-7 marker:text-slate-400">
          <input
            ref={el => { inputRefs.current[i] = el }}
            type="text"
            value={item}
            readOnly={readOnly}
            onChange={e => update(i, e.target.value)}
            onKeyDown={e => handleKeyDown(e, i)}
            placeholder="Elemento de lista"
            className="w-full outline-none bg-transparent placeholder:text-slate-300"
          />
        </li>
      ))}
    </Tag>
  )
}
