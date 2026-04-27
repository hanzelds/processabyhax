'use client'

import { useState, useCallback } from 'react'
import { ContentPiece, ContentPieceStatus, Client, ContentType, ContentPlatform, CopyStatus } from '@/types'
import {
  PIECE_STATUS_DOT, PIECE_STATUS_COLOR, PIECE_STATUS_LABEL,
  COPY_STATUS_COLOR, COPY_STATUS_LABEL, CONTENT_TYPE_ICON,
  PLATFORM_LABEL, clientColor,
} from '@/lib/utils'
import { api } from '@/lib/api'
import { ChevronLeft, ChevronRight, Plus, AlertTriangle } from 'lucide-react'
import { PieceModal } from './PieceModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function calendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month - 1, 1)
  const last  = new Date(year, month, 0)
  const days: Date[] = []
  // Pad to Monday
  const startDow = (first.getDay() + 6) % 7
  for (let i = startDow; i > 0; i--) {
    const d = new Date(first); d.setDate(d.getDate() - i); days.push(d)
  }
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) days.push(new Date(d))
  // Pad to complete grid row
  while (days.length % 7 !== 0) {
    const d = new Date(days[days.length - 1]); d.setDate(d.getDate() + 1); days.push(d)
  }
  return days
}

// ── Compact piece card ────────────────────────────────────────────────────────

function PieceChip({ piece, onClick }: { piece: ContentPiece; onClick: () => void }) {
  const copyAlert = piece.copyStatus === 'pendiente' && piece.status === 'programado'
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick() }}
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] cursor-pointer hover:opacity-80 transition-opacity border-l-2 bg-white border border-slate-100 ${
        piece.status === 'publicado' ? 'border-l-emerald-400' :
        piece.status === 'programado' ? 'border-l-purple-400' : 'border-l-slate-300'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PIECE_STATUS_DOT[piece.status]}`} />
      <span className="font-medium text-slate-700 truncate">{piece.title}</span>
      {copyAlert && <AlertTriangle className="w-3 h-3 text-orange-400 shrink-0" />}
    </div>
  )
}

// ── Inbox panel ───────────────────────────────────────────────────────────────

function InboxItem({ piece, onSchedule, onClick }: {
  piece: ContentPiece
  onSchedule: (id: string, date: string) => void
  onClick: () => void
}) {
  const [dragging, setDragging] = useState(false)
  const copyAlert = piece.copyStatus === 'pendiente'

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('pieceId', piece.id); setDragging(true) }}
      onDragEnd={() => setDragging(false)}
      onClick={onClick}
      className={`bg-white border rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all ${
        dragging ? 'opacity-40 rotate-1' : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2">{piece.title}</p>
        <span className="text-base shrink-0">{CONTENT_TYPE_ICON[piece.type]}</span>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${clientColor(piece.clientId)}`}>
          {piece.client.name}
        </span>
        {piece.platforms.map(p => (
          <span key={p} className="text-[9px] font-semibold px-1 py-0.5 bg-slate-100 text-slate-500 rounded">
            {PLATFORM_LABEL[p]}
          </span>
        ))}
      </div>
      {copyAlert && (
        <p className="text-[10px] text-orange-500 font-medium mt-1.5 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Copy pendiente
        </p>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  initialPieces: ContentPiece[]
  initialInbox: ContentPiece[]
  clients: Client[]
  isAdmin: boolean
}

export function CalendarView({ initialPieces, initialInbox, clients, isAdmin }: Props) {
  const now   = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [pieces, setPieces]   = useState(initialPieces)
  const [inbox, setInbox]     = useState(initialInbox)
  const [selected, setSelected] = useState<ContentPiece | null>(null)
  const [creating, setCreating] = useState<string | null>(null) // default date for new
  const [filterClient, setFilterClient] = useState('')
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)

  const days = calendarDays(year, month)
  const today = isoDate(now)

  function navigate(delta: number) {
    let m = month + delta, y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1)  { m = 12; y-- }
    setMonth(m); setYear(y)
    // Fetch new month data
    fetchMonth(y, m)
  }

  async function fetchMonth(y: number, m: number) {
    const params = new URLSearchParams({ year: String(y), month: String(m) })
    if (filterClient) params.set('clientId', filterClient)
    const data = await api.get<ContentPiece[]>(`/api/content/calendar?${params}`)
    setPieces(data)
  }

  function piecesForDay(dateStr: string) {
    return pieces.filter(p => p.scheduledDate?.startsWith(dateStr))
      .filter(p => !filterClient || p.clientId === filterClient)
  }

  async function handleDrop(e: React.DragEvent, date: Date) {
    e.preventDefault()
    const pieceId = e.dataTransfer.getData('pieceId')
    if (!pieceId) return
    const dateStr = isoDate(date)

    // Optimistic update
    const piece = inbox.find(p => p.id === pieceId) ?? pieces.find(p => p.id === pieceId)
    if (!piece) return

    const updated = await api.patch<ContentPiece>(`/api/content/pieces/${pieceId}/schedule`, {
      scheduledDate: dateStr,
    })
    setInbox(prev => prev.filter(p => p.id !== pieceId))
    setPieces(prev => {
      const without = prev.filter(p => p.id !== pieceId)
      return [...without, updated]
    })
    setHoveredDay(null)
  }

  const handlePieceUpdate = useCallback((updated: ContentPiece) => {
    setPieces(prev => prev.map(p => p.id === updated.id ? updated : p))
    setInbox(prev => prev.filter(p => p.id !== updated.id))
    if (updated.scheduledDate === null) {
      setInbox(prev => [updated, ...prev.filter(p => p.id !== updated.id)])
      setPieces(prev => prev.filter(p => p.id !== updated.id))
    }
    setSelected(updated)
  }, [])

  const handlePieceCreate = useCallback((created: ContentPiece) => {
    if (created.scheduledDate) {
      setPieces(prev => [created, ...prev])
    } else {
      setInbox(prev => [created, ...prev])
    }
    setCreating(null)
    setSelected(created)
  }, [])

  const monthName = new Date(year, month - 1, 1).toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })

  return (
    <div className="flex gap-4 h-full">
      {/* ── Calendar ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"><ChevronLeft className="w-4 h-4" /></button>
            <h2 className="text-base font-semibold text-slate-800 capitalize">{monthName}</h2>
            <button onClick={() => navigate(1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); fetchMonth(now.getFullYear(), now.getMonth() + 1) }} className="text-xs text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1 hover:bg-slate-50">Hoy</button>
          </div>
          <div className="flex items-center gap-2">
            <select value={filterClient} onChange={e => { setFilterClient(e.target.value); fetchMonth(year, month) }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
              <option value="">Todos los clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {isAdmin && (
              <button onClick={() => setCreating(today)} className="flex items-center gap-1.5 bg-[#17394f] text-white text-sm font-medium rounded-lg px-3 py-1.5">
                <Plus className="w-4 h-4" /> Nueva pieza
              </button>
            )}
          </div>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 mb-1">
          {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 flex-1 gap-px bg-slate-100 rounded-xl overflow-hidden border border-slate-100">
          {days.map((day, i) => {
            const ds   = isoDate(day)
            const isCurrentMonth = day.getMonth() + 1 === month
            const isToday = ds === today
            const dayPieces = piecesForDay(ds)
            const isHovered = hoveredDay === ds

            return (
              <div
                key={i}
                className={`bg-white min-h-[90px] p-1.5 flex flex-col transition-colors ${
                  !isCurrentMonth ? 'opacity-40' : ''
                } ${isHovered ? 'bg-[#17394f]/5' : ''}`}
                onDragOver={e => { e.preventDefault(); setHoveredDay(ds) }}
                onDragLeave={() => setHoveredDay(null)}
                onDrop={e => handleDrop(e, day)}
                onClick={() => isAdmin && setCreating(ds)}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-[#17394f] text-white' : 'text-slate-600'
                  }`}>
                    {day.getDate()}
                  </span>
                </div>
                {/* Pieces */}
                <div className="space-y-0.5 flex-1">
                  {dayPieces.slice(0, 3).map(p => (
                    <PieceChip key={p.id} piece={p} onClick={() => setSelected(p)} />
                  ))}
                  {dayPieces.length > 3 && (
                    <p className="text-[10px] text-slate-400 font-medium pl-1">+{dayPieces.length - 3} más</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Inbox sidebar ── */}
      <div className="w-64 shrink-0 flex flex-col">
        <div className="bg-white rounded-2xl border border-slate-200 flex flex-col flex-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sin programar</p>
            <p className="text-xs text-slate-400 mt-0.5">{inbox.filter(p => !filterClient || p.clientId === filterClient).length} piezas · arrastra al calendario</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {inbox
              .filter(p => !filterClient || p.clientId === filterClient)
              .map(p => (
                <InboxItem
                  key={p.id}
                  piece={p}
                  onSchedule={() => {}}
                  onClick={() => setSelected(p)}
                />
              ))
            }
            {inbox.filter(p => !filterClient || p.clientId === filterClient).length === 0 && (
              <div className="text-center py-8">
                <p className="text-xs text-slate-300 font-medium">Bandeja vacía</p>
                <p className="text-[10px] text-slate-200 mt-1">Las piezas listas aparecen aquí</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Piece detail modal */}
      {selected && (
        <PieceModal
          piece={selected}
          clients={clients}
          isAdmin={isAdmin}
          onUpdate={handlePieceUpdate}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Create piece modal */}
      {creating !== null && (
        <PieceModal
          piece={null}
          defaultDate={creating}
          clients={clients}
          isAdmin={isAdmin}
          onUpdate={() => {}}
          onCreate={handlePieceCreate}
          onClose={() => setCreating(null)}
        />
      )}
    </div>
  )
}
