'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Link2, Link2Off, Check } from 'lucide-react'

// ── Color palettes ────────────────────────────────────────────────────────────

const TEXT_COLORS = [
  { hex: 'inherit', label: 'Predeterminado' },
  { hex: '#0f172a',  label: 'Negro' },
  { hex: '#64748b',  label: 'Gris' },
  { hex: '#ef4444',  label: 'Rojo' },
  { hex: '#f97316',  label: 'Naranja' },
  { hex: '#eab308',  label: 'Amarillo' },
  { hex: '#22c55e',  label: 'Verde' },
  { hex: '#3b82f6',  label: 'Azul' },
  { hex: '#a855f7',  label: 'Violeta' },
]

const HIGHLIGHT_COLORS = [
  { hex: 'transparent', label: 'Sin resaltado' },
  { hex: '#fef08a',     label: 'Amarillo' },
  { hex: '#bbf7d0',     label: 'Verde' },
  { hex: '#bfdbfe',     label: 'Azul' },
  { hex: '#fbcfe8',     label: 'Rosa' },
  { hex: '#fecaca',     label: 'Rojo' },
  { hex: '#e9d5ff',     label: 'Violeta' },
  { hex: '#fed7aa',     label: 'Naranja' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function saveSelection(): Range | null {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  return sel.getRangeAt(0).cloneRange()
}

function restoreSelection(range: Range | null) {
  if (!range) return
  const sel = window.getSelection()
  if (!sel) return
  sel.removeAllRanges()
  sel.addRange(range)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ColorPicker({ colors, onSelect, currentColor, onClose }: {
  colors: { hex: string; label: string }[]
  onSelect: (hex: string) => void
  currentColor?: string
  onClose: () => void
}) {
  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-10 grid grid-cols-3 gap-1"
      style={{ minWidth: '120px' }}
      onMouseDown={e => e.stopPropagation()}
    >
      {colors.map(c => (
        <button
          key={c.hex}
          title={c.label}
          onMouseDown={e => { e.preventDefault(); onSelect(c.hex); onClose() }}
          className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:scale-110 transition-transform relative"
          style={c.hex === 'transparent' || c.hex === 'inherit'
            ? { background: 'white', backgroundImage: 'repeating-linear-gradient(45deg, #e2e8f0 0, #e2e8f0 2px, transparent 0, transparent 50%)' }
            : { backgroundColor: c.hex }
          }
        >
          {currentColor === c.hex && (
            <Check className="w-3 h-3 text-slate-700" strokeWidth={3} />
          )}
        </button>
      ))}
    </div>
  )
}

function LinkEditor({ savedRange, onClose }: { savedRange: Range | null; onClose: () => void }) {
  const [url, setUrl] = useState(() => {
    // Try to get current link URL from selection
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return ''
    const node = sel.getRangeAt(0).commonAncestorContainer
    const a = node.nodeType === 1
      ? (node as Element).closest?.('a')
      : (node.parentElement?.closest?.('a'))
    return a?.getAttribute('href') ?? ''
  })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function confirm() {
    restoreSelection(savedRange)
    if (url.trim()) {
      document.execCommand('createLink', false, url.trim().startsWith('http') ? url.trim() : 'https://' + url.trim())
    }
    onClose()
  }

  function remove() {
    restoreSelection(savedRange)
    document.execCommand('unlink', false)
    onClose()
  }

  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-10 flex items-center gap-1"
      style={{ minWidth: '220px' }}
      onMouseDown={e => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        value={url}
        onChange={e => setUrl(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirm() } if (e.key === 'Escape') onClose() }}
        placeholder="https://..."
        className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-[#17394f] text-slate-700 bg-white"
      />
      <button
        onMouseDown={e => { e.preventDefault(); confirm() }}
        className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#17394f] text-white hover:bg-[#1e4a65] transition-colors shrink-0"
        title="Confirmar"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      {url && (
        <button
          onMouseDown={e => { e.preventDefault(); remove() }}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
          title="Quitar enlace"
        >
          <Link2Off className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Main toolbar ──────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

type PopoverType = 'text-color' | 'highlight' | 'link' | null

export function InlineToolbar({ onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos]               = useState<{ top: number; left: number } | null>(null)
  const [activeFormats, setActive]  = useState<Record<string, boolean>>({})
  const [popover, setPopover]       = useState<PopoverType>(null)
  const [savedRange, setSavedRange] = useState<Range | null>(null)

  const updatePosition = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.rangeCount) { setPos(null); return }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    if (rect.width === 0) { setPos(null); return }
    const above = rect.top - 44 - 4
    setPos({
      top:  above > 8 ? above : rect.bottom + 4,
      left: rect.left + rect.width / 2 - 150,
    })
    setActive({
      bold:          document.queryCommandState('bold'),
      italic:        document.queryCommandState('italic'),
      underline:     document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
    })
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', updatePosition)
    return () => document.removeEventListener('selectionchange', updatePosition)
  }, [updatePosition])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setPopover(null)
        onClose()
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [onClose])

  if (!pos) return null

  function applyFormat(cmd: string) {
    document.execCommand(cmd, false)
    setActive(prev => ({ ...prev, [cmd]: !prev[cmd] }))
  }

  function applyTextColor(hex: string) {
    document.execCommand('styleWithCSS', false, 'true')
    if (hex === 'inherit') {
      document.execCommand('removeFormat', false)
    } else {
      document.execCommand('foreColor', false, hex)
    }
    document.execCommand('styleWithCSS', false, 'false')
  }

  function applyHighlight(hex: string) {
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('hiliteColor', false, hex === 'transparent' ? 'transparent' : hex)
    document.execCommand('styleWithCSS', false, 'false')
  }

  function togglePopover(type: PopoverType) {
    if (popover === type) { setPopover(null); return }
    setSavedRange(saveSelection())
    setPopover(type)
  }

  const clampedLeft = Math.max(8, Math.min(pos.left, window.innerWidth - 320))
  const clampedTop  = Math.max(8, pos.top)

  const btnBase = 'flex items-center justify-center rounded transition-colors'
  const active  = 'bg-white/20 text-white'
  const inactive = 'text-white/70 hover:text-white hover:bg-white/10'

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-[#17394f] rounded-xl shadow-lg"
      style={{ top: clampedTop, left: clampedLeft }}
      onMouseDown={e => e.preventDefault()}
    >
      <div className="flex items-center gap-0.5 px-1.5 py-1.5">

        {/* Basic formats */}
        <button onClick={() => applyFormat('bold')}          title="Negrita (⌘B)"  className={`w-7 h-7 text-sm font-bold   ${btnBase} ${activeFormats.bold          ? active : inactive}`}>B</button>
        <button onClick={() => applyFormat('italic')}        title="Cursiva (⌘I)"  className={`w-7 h-7 text-sm italic      ${btnBase} ${activeFormats.italic        ? active : inactive}`}>I</button>
        <button onClick={() => applyFormat('underline')}     title="Subrayado (⌘U)"className={`w-7 h-7 text-sm underline   ${btnBase} ${activeFormats.underline     ? active : inactive}`}>U</button>
        <button onClick={() => applyFormat('strikeThrough')} title="Tachado (⌘⇧X)" className={`w-7 h-7 text-sm line-through ${btnBase} ${activeFormats.strikeThrough ? active : inactive}`}>S</button>

        <div className="w-px h-4 bg-white/20 mx-0.5" />

        {/* Text color */}
        <div className="relative">
          <button
            onClick={() => togglePopover('text-color')}
            title="Color de texto"
            className={`w-7 h-7 text-xs font-bold flex flex-col items-center justify-center gap-0.5 rounded transition-colors ${popover === 'text-color' ? active : inactive}`}
          >
            <span className="text-sm font-bold leading-none">A</span>
            <span className="w-3.5 h-0.5 rounded-full bg-red-400" />
          </button>
          {popover === 'text-color' && (
            <ColorPicker
              colors={TEXT_COLORS}
              onSelect={applyTextColor}
              onClose={() => setPopover(null)}
            />
          )}
        </div>

        {/* Highlight */}
        <div className="relative">
          <button
            onClick={() => togglePopover('highlight')}
            title="Resaltar texto"
            className={`w-7 h-7 text-xs font-bold flex flex-col items-center justify-center gap-0.5 rounded transition-colors ${popover === 'highlight' ? active : inactive}`}
          >
            <span className="text-sm leading-none">✦</span>
            <span className="w-3.5 h-0.5 rounded-full bg-yellow-300" />
          </button>
          {popover === 'highlight' && (
            <ColorPicker
              colors={HIGHLIGHT_COLORS}
              onSelect={applyHighlight}
              onClose={() => setPopover(null)}
            />
          )}
        </div>

        <div className="w-px h-4 bg-white/20 mx-0.5" />

        {/* Remove format */}
        <button
          onClick={() => document.execCommand('removeFormat')}
          title="Quitar formato"
          className={`w-7 h-7 text-xs ${btnBase} ${inactive}`}
        >
          Aa
        </button>

        {/* Link */}
        <div className="relative">
          <button
            onClick={() => togglePopover('link')}
            title="Enlace (⌘K)"
            className={`w-7 h-7 ${btnBase} ${popover === 'link' ? active : inactive}`}
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
          {popover === 'link' && (
            <LinkEditor
              savedRange={savedRange}
              onClose={() => setPopover(null)}
            />
          )}
        </div>

      </div>
    </div>
  )
}
