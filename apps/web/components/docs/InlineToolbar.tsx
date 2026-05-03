'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onClose: () => void
}

const FORMATS = [
  { cmd: 'bold',          label: 'B',  title: 'Negrita',       cls: 'font-bold' },
  { cmd: 'italic',        label: 'I',  title: 'Cursiva',       cls: 'italic' },
  { cmd: 'underline',     label: 'U',  title: 'Subrayado',     cls: 'underline' },
  { cmd: 'strikeThrough', label: 'S',  title: 'Tachado',       cls: 'line-through' },
]

export function InlineToolbar({ onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({})

  useEffect(() => {
    function update() {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        setPos(null); return
      }
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      if (rect.width === 0) { setPos(null); return }
      setPos({ top: rect.top - 44, left: rect.left + rect.width / 2 - 120 })
      setActiveFormats({
        bold:          document.queryCommandState('bold'),
        italic:        document.queryCommandState('italic'),
        underline:     document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
      })
    }

    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [onClose])

  if (!pos) return null

  function applyFormat(cmd: string) {
    document.execCommand(cmd, false)
    setActiveFormats(prev => ({ ...prev, [cmd]: !prev[cmd] }))
  }

  function applyLink() {
    const url = prompt('URL del enlace:')
    if (url) document.execCommand('createLink', false, url)
  }

  const clampedLeft = Math.max(8, Math.min(pos.left, window.innerWidth - 248))
  const clampedTop  = Math.max(8, pos.top)

  return (
    <div
      ref={ref}
      className="fixed z-50 flex items-center gap-0.5 bg-[#17394f] rounded-lg px-1.5 py-1 shadow-lg"
      style={{ top: clampedTop, left: clampedLeft }}
      onMouseDown={e => e.preventDefault()} // don't steal focus
    >
      {FORMATS.map(f => (
        <button
          key={f.cmd}
          onClick={() => applyFormat(f.cmd)}
          title={f.title}
          className={`w-7 h-7 flex items-center justify-center rounded text-sm transition-colors ${
            activeFormats[f.cmd]
              ? 'bg-white/20 text-white'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          } ${f.cls}`}
        >
          {f.label}
        </button>
      ))}
      <div className="w-px h-4 bg-white/20 mx-0.5" />
      <button
        onClick={() => document.execCommand('removeFormat')}
        title="Quitar formato"
        className="w-7 h-7 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 text-xs"
      >
        Aa
      </button>
      <button
        onClick={applyLink}
        title="Insertar enlace"
        className="w-7 h-7 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 text-xs"
      >
        🔗
      </button>
    </div>
  )
}
