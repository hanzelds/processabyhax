'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ChevronLeft, ChevronRight, CalendarDays, List, LayoutGrid,
  Clock, MapPin, Users, Play, CheckCircle2, Circle, AlertCircle,
  Loader2, Plus, X, Pencil, ExternalLink, Trash2, Film, FileText,
} from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { DayPlanData, WorkBlock, Task, Shoot, ContentPiece } from '@/types'
import { useTimerStore } from '@/store/timerStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = 'agenda' | 'lista'
interface Filters { tasks: boolean; shoots: boolean; pieces: boolean; blocks: boolean }

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function todayStr(): string {
  return toDateStr(new Date())
}

function formatHeaderDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12  = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function durationLabel(start: string, end: string): string {
  const mins = timeToMinutes(end) - timeToMinutes(start)
  if (mins <= 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En progreso',
  IN_REVIEW: 'En revisión', COMPLETED: 'Completada', BLOCKED: 'Bloqueada',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-500',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  IN_REVIEW: 'bg-amber-50 text-amber-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  BLOCKED: 'bg-red-50 text-red-500',
}

const BLOCK_COLORS = ['#17394f','#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899']

// Grid: 6am (360) to 22pm (1320) = 960 min = 64 slots of 15min
const GRID_START  = 6 * 60    // 360
const GRID_END    = 22 * 60   // 1320
const GRID_TOTAL  = GRID_END - GRID_START
const SLOT_HEIGHT = 48         // px per hour

function timeToTop(t: string): number {
  const mins = timeToMinutes(t) - GRID_START
  return (mins / 60) * SLOT_HEIGHT
}

function timeToPct(t: string): number {
  return ((timeToMinutes(t) - GRID_START) / GRID_TOTAL) * 100
}

// ── Popover component ─────────────────────────────────────────────────────────

interface BlockPopoverProps {
  block: WorkBlock
  linkedTask?: Task
  linkedShoot?: Shoot
  linkedPiece?: ContentPiece
  onClose: () => void
  onUpdate: (updated: WorkBlock) => void
  onDelete: (id: string) => void
  onStatusChange: (taskId: string, status: string) => void
  onStartTimer: (taskId: string, title: string, projectId?: string) => void
}

function BlockPopover({ block, linkedTask, linkedShoot, linkedPiece, onClose, onUpdate, onDelete, onStatusChange, onStartTimer }: BlockPopoverProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle]     = useState(block.title ?? '')
  const [notes, setNotes]     = useState(block.notes ?? '')
  const [start, setStart]     = useState(block.startTime)
  const [end, setEnd]         = useState(block.endTime)
  const [saving, setSaving]   = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await api.patch<WorkBlock>(`/api/day-plan/blocks/${block.id}`, {
        title: title || null, notes: notes || null, startTime: start, endTime: end,
      })
      onUpdate(updated)
      setEditing(false)
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    await api.delete(`/api/day-plan/blocks/${block.id}`)
    onDelete(block.id)
    onClose()
  }

  const color = block.color || '#17394f'

  return (
    <div className="absolute right-0 top-0 z-50 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
      {/* Header band */}
      <div className="h-1.5" style={{ background: color }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          {editing ? (
            <input value={title} onChange={e => setTitle(e.target.value)} className="flex-1 text-sm font-medium border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-[#17394f]" placeholder="Título del bloque" autoFocus />
          ) : (
            <p className="flex-1 text-sm font-semibold text-slate-800">{block.title || 'Bloque sin título'}</p>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setEditing(e => !e)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400"><Pencil className="w-3 h-3" /></button>
            <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400"><X className="w-3 h-3" /></button>
          </div>
        </div>

        {/* Time row */}
        <div className="flex items-center gap-2 mb-3">
          {editing ? (
            <>
              <input type="time" value={start} onChange={e => setStart(e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:border-[#17394f]" />
              <span className="text-slate-300">→</span>
              <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:border-[#17394f]" />
            </>
          ) : (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              {formatTime(block.startTime)} → {formatTime(block.endTime)} · {durationLabel(block.startTime, block.endTime)}
            </span>
          )}
        </div>

        {/* Notes */}
        {(editing || block.notes) && (
          <div className="mb-3">
            {editing ? (
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notas..." className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#17394f] resize-none" />
            ) : (
              <p className="text-xs text-slate-500">{block.notes}</p>
            )}
          </div>
        )}

        {/* Linked task actions */}
        {linkedTask && (
          <div className="border border-slate-100 rounded-lg p-2 mb-3 bg-slate-50">
            <p className="text-xs font-medium text-slate-700 truncate mb-1.5">{linkedTask.title}</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {(['PENDING','IN_PROGRESS','COMPLETED'] as const).map(s => (
                <button key={s} onClick={() => onStatusChange(linkedTask.id, s)}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${linkedTask.status === s ? STATUS_COLOR[s] : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onStartTimer(linkedTask.id, linkedTask.title, linkedTask.project?.id)}
                className="flex items-center gap-1 text-xs bg-[#17394f] text-white px-2 py-1 rounded-lg hover:bg-[#1e4a65] transition-colors">
                <Play className="w-3 h-3" /> Iniciar timer
              </button>
              {linkedTask.project && (
                <Link href={`/projects/${linkedTask.project.id}`} className="text-xs text-slate-400 hover:text-[#17394f] flex items-center gap-0.5">
                  <ExternalLink className="w-3 h-3" /> Ver proyecto
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Linked shoot */}
        {linkedShoot && (
          <div className="border border-slate-100 rounded-lg p-2 mb-3 bg-slate-50">
            <div className="flex items-center gap-1.5 mb-1">
              <Film className="w-3.5 h-3.5 text-amber-500" />
              <p className="text-xs font-medium text-slate-700 truncate">{linkedShoot.title}</p>
            </div>
            {linkedShoot.location && (
              <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{linkedShoot.location.name}</p>
            )}
            <Link href={`/logistica/rodajes/${linkedShoot.id}`} className="mt-1 text-xs text-slate-400 hover:text-[#17394f] flex items-center gap-0.5">
              <ExternalLink className="w-3 h-3" /> Ver rodaje
            </Link>
          </div>
        )}

        {/* Linked piece */}
        {linkedPiece && (
          <div className="border border-slate-100 rounded-lg p-2 mb-3 bg-slate-50">
            <div className="flex items-center gap-1.5 mb-1">
              <FileText className="w-3.5 h-3.5 text-emerald-500" />
              <p className="text-xs font-medium text-slate-700 truncate">{linkedPiece.title}</p>
            </div>
            <Link href={`/content/calendar`} className="text-xs text-slate-400 hover:text-[#17394f] flex items-center gap-0.5">
              <ExternalLink className="w-3 h-3" /> Ver calendario
            </Link>
          </div>
        )}

        {editing ? (
          <div className="flex gap-2 pt-1">
            <button onClick={() => setEditing(false)} className="flex-1 text-xs border border-slate-200 rounded-lg py-1.5 text-slate-500 hover:bg-slate-50">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-1 text-xs bg-[#17394f] text-white rounded-lg py-1.5 hover:bg-[#1e4a65] disabled:opacity-50">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}Guardar
            </button>
          </div>
        ) : (
          <button onClick={handleDelete} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors mt-1">
            <Trash2 className="w-3 h-3" /> Eliminar bloque
          </button>
        )}
      </div>
    </div>
  )
}

// ── New Block Modal ───────────────────────────────────────────────────────────

interface NewBlockModalProps {
  date: string
  defaultStartTime?: string
  linkedTask?: Task
  linkedShoot?: Shoot
  linkedPiece?: ContentPiece
  onSave: (block: WorkBlock) => void
  onClose: () => void
}

function NewBlockModal({ date, defaultStartTime, linkedTask, linkedShoot, linkedPiece, onSave, onClose }: NewBlockModalProps) {
  const defaultEnd = defaultStartTime
    ? minutesToTime(Math.min(timeToMinutes(defaultStartTime) + 60, GRID_END))
    : '10:00'
  const [title, setTitle]     = useState(linkedTask?.title ?? linkedShoot?.title ?? linkedPiece?.title ?? '')
  const [start, setStart]     = useState(defaultStartTime ?? '09:00')
  const [end, setEnd]         = useState(defaultEnd)
  const [color, setColor]     = useState(BLOCK_COLORS[0])
  const [notes, setNotes]     = useState('')
  const [saving, setSaving]   = useState(false)

  async function handleSave() {
    if (!start || !end) return
    setSaving(true)
    try {
      const block = await api.post<WorkBlock>('/api/day-plan/blocks', {
        date, startTime: start, endTime: end,
        title: title || null, notes: notes || null, color,
        taskId:         linkedTask?.id         ?? null,
        shootId:        linkedShoot?.id        ?? null,
        contentPieceId: linkedPiece?.id        ?? null,
      })
      onSave(block)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">Nuevo bloque</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        {/* Linked item preview */}
        {(linkedTask || linkedShoot || linkedPiece) && (
          <div className="mb-4 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-0.5">
              {linkedTask ? 'Tarea' : linkedShoot ? 'Rodaje' : 'Contenido'}
            </p>
            <p className="text-xs font-medium text-slate-700 truncate">
              {linkedTask?.title ?? linkedShoot?.title ?? linkedPiece?.title}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Título</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="¿Qué harás en este bloque?" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Inicio</label>
              <input type="time" value={start} onChange={e => setStart(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fin</label>
              <input type="time" value={end} onChange={e => setEnd(e.target.value)} min={start} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f]" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Color</label>
            <div className="flex items-center gap-2">
              {BLOCK_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Opcional..." className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] resize-none" />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 text-sm border border-slate-200 rounded-lg py-2 hover:bg-slate-50 text-slate-600">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !start || !end}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#17394f] hover:bg-[#1e4a65] text-white text-sm font-medium rounded-lg py-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Crear bloque
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Client Component ─────────────────────────────────────────────────────

export function DayPlannerClient() {
  const [date, setDate]       = useState(todayStr())
  const [view, setView]       = useState<ViewMode>('agenda')
  const [data, setData]       = useState<DayPlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>(() => {
    if (typeof window === 'undefined') return { tasks: true, shoots: true, pieces: true, blocks: true }
    try { return JSON.parse(localStorage.getItem('day-planner-filters') || 'null') ?? { tasks: true, shoots: true, pieces: true, blocks: true } }
    catch { return { tasks: true, shoots: true, pieces: true, blocks: true } }
  })

  // Modal / popover state
  const [newBlockModal, setNewBlockModal] = useState<{
    open: boolean
    startTime?: string
    linked?: { task?: Task; shoot?: Shoot; piece?: ContentPiece }
  }>({ open: false })
  const [activePopover, setActivePopover] = useState<string | null>(null)

  const timerStore = useTimerStore()

  // Persist filters
  useEffect(() => {
    localStorage.setItem('day-planner-filters', JSON.stringify(filters))
  }, [filters])

  const loadData = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const result = await api.get<DayPlanData>(`/api/day-plan?date=${d}`)
      setData(result)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData(date) }, [date, loadData])

  function prevDay() { const d = new Date(date + 'T12:00'); d.setDate(d.getDate() - 1); setDate(toDateStr(d)) }
  function nextDay() { const d = new Date(date + 'T12:00'); d.setDate(d.getDate() + 1); setDate(toDateStr(d)) }
  function goToday() { setDate(todayStr()) }

  // Find assigned work blocks by linked item id
  function assignedIds(): Set<string> {
    const s = new Set<string>()
    data?.workBlocks.forEach(b => {
      if (b.taskId)         s.add(b.taskId)
      if (b.shootId)        s.add(b.shootId)
      if (b.contentPieceId) s.add(b.contentPieceId)
    })
    return s
  }

  async function handleStatusChange(taskId: string, status: string) {
    try {
      const updated = await api.patch<{ id: string; status: string }>(`/api/day-plan/tasks/${taskId}/status`, { status })
      setData(prev => prev ? {
        ...prev,
        tasks: prev.tasks.map(t => t.id === taskId ? { ...t, status: updated.status as Task['status'] } : t),
        workBlocks: prev.workBlocks, // unchanged
      } : prev)
    } catch { /* silent */ }
  }

  async function handleStartTimer(taskId: string, title: string, projectId?: string) {
    try {
      await api.post('/api/time/timer/start', { taskId, projectId, description: title })
      const active = await api.get<{ id: string; taskId?: string; projectId?: string; description?: string; startedAt: string; minutesElapsed: number }>('/api/time/timer/active')
      if (active) timerStore.setActive(active as any)
    } catch { /* silent */ }
  }

  function handleBlockSaved(block: WorkBlock) {
    setData(prev => prev ? { ...prev, workBlocks: [...prev.workBlocks, block].sort((a, b) => a.startTime.localeCompare(b.startTime)) } : prev)
    setNewBlockModal({ open: false })
  }

  function handleBlockUpdated(block: WorkBlock) {
    setData(prev => prev ? { ...prev, workBlocks: prev.workBlocks.map(b => b.id === block.id ? block : b) } : prev)
    setActivePopover(null)
  }

  function handleBlockDeleted(id: string) {
    setData(prev => prev ? { ...prev, workBlocks: prev.workBlocks.filter(b => b.id !== id) } : prev)
  }

  // ── Render: Header ──────────────────────────────────────────────────────────

  const isToday = date === todayStr()

  const header = (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      {/* Date navigation */}
      <div className="flex items-center gap-2">
        <button onClick={prevDay} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-base font-semibold text-slate-900 capitalize leading-tight">{formatHeaderDate(date)}</p>
          {isToday && <p className="text-xs text-[#17394f] font-medium">Hoy</p>}
        </div>
        <button onClick={nextDay} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500">
          <ChevronRight className="w-4 h-4" />
        </button>
        {!isToday && (
          <button onClick={goToday} className="text-xs font-medium text-[#17394f] border border-[#17394f]/30 rounded-lg px-3 py-1.5 hover:bg-[#17394f]/5 transition-colors">
            Hoy
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Filter toggles */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {([
            { key: 'tasks',  label: 'Tareas',   icon: '🎯' },
            { key: 'shoots', label: 'Rodajes',  icon: '🎬' },
            { key: 'pieces', label: 'Contenido', icon: '📅' },
            { key: 'blocks', label: 'Bloques',  icon: '⬜' },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setFilters(p => ({ ...p, [f.key]: !p[f.key] }))}
              title={f.label}
              className={`text-sm px-2 py-1 rounded-md transition-colors ${filters[f.key] ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400'}`}>
              {f.icon}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button onClick={() => setView('agenda')} title="Agenda"
            className={`w-8 h-7 flex items-center justify-center rounded-md transition-colors ${view === 'agenda' ? 'bg-white shadow-sm text-[#17394f]' : 'text-slate-400'}`}>
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setView('lista')} title="Lista"
            className={`w-8 h-7 flex items-center justify-center rounded-md transition-colors ${view === 'lista' ? 'bg-white shadow-sm text-[#17394f]' : 'text-slate-400'}`}>
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* New block button */}
        <button onClick={() => setNewBlockModal({ open: true })}
          className="flex items-center gap-1.5 bg-[#17394f] hover:bg-[#1e4a65] text-white text-sm font-medium rounded-lg px-3 py-2 transition-colors">
          <Plus className="w-4 h-4" /> Nuevo bloque
        </button>
      </div>
    </div>
  )

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-[#17394f]" />
    </div>
  )

  const assigned = assignedIds()

  // Items without a block (unassigned)
  const unassignedTasks   = filters.tasks  ? (data?.tasks          ?? []).filter(t => !assigned.has(t.id))   : []
  const unassignedShoots  = filters.shoots ? (data?.shoots         ?? []).filter(s => !assigned.has(s.id))   : []
  const unassignedPieces  = filters.pieces ? (data?.contentPieces  ?? []).filter(p => !assigned.has(p.id))   : []

  // ── Agenda View ─────────────────────────────────────────────────────────────

  if (view === 'agenda') {
    const hours = Array.from({ length: GRID_END / 60 - GRID_START / 60 }, (_, i) => i + GRID_START / 60)

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          {header}

          <div className="flex gap-4">
            {/* Hour grid */}
            <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex">
                {/* Hour labels */}
                <div className="w-14 shrink-0 border-r border-slate-100">
                  {hours.map(h => (
                    <div key={h} className="flex items-start justify-end pr-2 pt-1" style={{ height: SLOT_HEIGHT }}>
                      <span className="text-[10px] text-slate-400 font-medium">{h % 12 || 12}{h < 12 ? 'am' : 'pm'}</span>
                    </div>
                  ))}
                </div>

                {/* Blocks area */}
                <div className="flex-1 relative" style={{ height: hours.length * SLOT_HEIGHT }}>
                  {/* Hour lines */}
                  {hours.map((h, i) => (
                    <div key={h} className="absolute left-0 right-0 border-t border-slate-100" style={{ top: i * SLOT_HEIGHT }}>
                      {/* 30-min line */}
                      <div className="absolute left-0 right-0 border-t border-slate-50" style={{ top: SLOT_HEIGHT / 2 }} />
                    </div>
                  ))}

                  {/* Current time indicator */}
                  {isToday && (() => {
                    const now = new Date()
                    const nowMins = now.getHours() * 60 + now.getMinutes()
                    if (nowMins >= GRID_START && nowMins <= GRID_END) {
                      const top = ((nowMins - GRID_START) / 60) * SLOT_HEIGHT
                      return (
                        <div className="absolute left-0 right-0 z-10 flex items-center" style={{ top }}>
                          <div className="w-2 h-2 rounded-full bg-red-500 ml-0.5" />
                          <div className="flex-1 h-px bg-red-500 opacity-60" />
                        </div>
                      )
                    }
                  })()}

                  {/* Work blocks */}
                  {filters.blocks && (data?.workBlocks ?? []).map(block => {
                    const top    = timeToTop(block.startTime)
                    const height = Math.max(24, timeToTop(block.endTime) - top)
                    const color  = block.color || '#17394f'
                    const linkedTask  = data?.tasks.find(t => t.id === block.taskId)
                    const linkedShoot = data?.shoots.find(s => s.id === block.shootId)
                    const linkedPiece = data?.contentPieces.find(p => p.id === block.contentPieceId)

                    return (
                      <div key={block.id} className="absolute left-1 right-1 rounded-lg overflow-hidden cursor-pointer hover:brightness-95 transition-all"
                        style={{ top, height, background: color + '22', borderLeft: `3px solid ${color}` }}
                        onClick={() => setActivePopover(p => p === block.id ? null : block.id)}>
                        <div className="px-2 py-1">
                          <p className="text-xs font-semibold truncate" style={{ color }}>{block.title || 'Bloque'}</p>
                          {height > 32 && <p className="text-[10px] opacity-70" style={{ color }}>{formatTime(block.startTime)} – {formatTime(block.endTime)}</p>}
                          {height > 48 && linkedTask && (
                            <p className="text-[10px] opacity-60 truncate" style={{ color }}>🎯 {linkedTask.title}</p>
                          )}
                          {height > 48 && linkedShoot && (
                            <p className="text-[10px] opacity-60 truncate" style={{ color }}>🎬 {linkedShoot.title}</p>
                          )}
                        </div>

                        {/* Popover */}
                        {activePopover === block.id && (
                          <BlockPopover
                            block={block}
                            linkedTask={linkedTask}
                            linkedShoot={linkedShoot}
                            linkedPiece={linkedPiece}
                            onClose={() => setActivePopover(null)}
                            onUpdate={handleBlockUpdated}
                            onDelete={handleBlockDeleted}
                            onStatusChange={handleStatusChange}
                            onStartTimer={handleStartTimer}
                          />
                        )}
                      </div>
                    )
                  })}

                  {/* Shoot blocks without a WorkBlock */}
                  {filters.shoots && (data?.shoots ?? []).filter(s => !assigned.has(s.id)).map(shoot => {
                    const h  = parseInt(shoot.shootDate.slice(11, 13)) || 8
                    const top = ((h - GRID_START / 60) / 1) * SLOT_HEIGHT
                    return (
                      <div key={shoot.id} className="absolute left-1 right-8 rounded-lg overflow-hidden" style={{ top, height: SLOT_HEIGHT * 2, background: '#f59e0b22', borderLeft: '3px solid #f59e0b' }}>
                        <div className="px-2 py-1">
                          <p className="text-xs font-semibold text-amber-700 truncate">🎬 {shoot.title}</p>
                          {shoot.location && <p className="text-[10px] text-amber-600 flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{shoot.location.name}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Unassigned panel */}
            {(unassignedTasks.length > 0 || unassignedShoots.length > 0 || unassignedPieces.length > 0) && (
              <div className="w-60 shrink-0">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Sin asignar</h3>
                <div className="space-y-1.5">
                  {unassignedTasks.map(t => (
                    <button key={t.id} onClick={() => setNewBlockModal({ open: true, linked: { task: t } })}
                      className="w-full text-left bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-[#17394f]/40 hover:shadow-sm transition-all group">
                      <p className="text-xs font-medium text-slate-700 truncate group-hover:text-[#17394f]">🎯 {t.title}</p>
                      {t.project?.client && <p className="text-[10px] text-slate-400 truncate">{t.project.client.name}</p>}
                    </button>
                  ))}
                  {unassignedShoots.map(s => (
                    <button key={s.id} onClick={() => setNewBlockModal({ open: true, linked: { shoot: s } })}
                      className="w-full text-left bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-amber-300 transition-all group">
                      <p className="text-xs font-medium text-slate-700 truncate group-hover:text-amber-700">🎬 {s.title}</p>
                      {s.client && <p className="text-[10px] text-slate-400 truncate">{s.client.name}</p>}
                    </button>
                  ))}
                  {unassignedPieces.map(p => (
                    <button key={p.id} onClick={() => setNewBlockModal({ open: true, linked: { piece: p } })}
                      className="w-full text-left bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-emerald-300 transition-all group">
                      <p className="text-xs font-medium text-slate-700 truncate group-hover:text-emerald-700">📅 {p.title}</p>
                      {p.client && <p className="text-[10px] text-slate-400 truncate">{p.client.name}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {newBlockModal.open && (
          <NewBlockModal
            date={date}
            defaultStartTime={newBlockModal.startTime}
            linkedTask={newBlockModal.linked?.task}
            linkedShoot={newBlockModal.linked?.shoot}
            linkedPiece={newBlockModal.linked?.piece}
            onSave={handleBlockSaved}
            onClose={() => setNewBlockModal({ open: false })}
          />
        )}
      </div>
    )
  }

  // ── Lista View ──────────────────────────────────────────────────────────────

  // Build unified chronological list
  type DayItem = { sort: number; el: React.ReactNode; key: string }
  const items: DayItem[] = []

  if (filters.blocks) {
    (data?.workBlocks ?? []).forEach(block => {
      const sort = timeToMinutes(block.startTime)
      const linkedTask  = data?.tasks.find(t => t.id === block.taskId)
      const color = block.color || '#17394f'
      items.push({
        key: 'block-' + block.id, sort,
        el: (
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-start gap-3 hover:shadow-sm transition-shadow group">
            <div className="w-1 self-stretch rounded-full shrink-0 mt-0.5" style={{ background: color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-medium text-slate-400">{formatTime(block.startTime)} → {formatTime(block.endTime)}</span>
                <span className="text-[10px] text-slate-300">{durationLabel(block.startTime, block.endTime)}</span>
              </div>
              <p className="text-sm font-semibold text-slate-800">{block.title || 'Bloque sin título'}</p>
              {linkedTask && <p className="text-xs text-slate-400 truncate mt-0.5">🎯 {linkedTask.title}</p>}
              {block.notes && <p className="text-xs text-slate-400 mt-1">{block.notes}</p>}
            </div>
            <button onClick={() => setActivePopover(p => p === block.id ? null : block.id)}
              className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-all shrink-0">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        ),
      })
    })
  }

  if (filters.tasks) {
    (data?.tasks ?? []).forEach(task => {
      const sort = assigned.has(task.id) ? -1 : 9999 // assigned items sorted by block time
      items.push({
        key: 'task-' + task.id, sort,
        el: (
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-start gap-3 hover:shadow-sm transition-shadow">
            <div className="shrink-0 mt-0.5">
              {task.status === 'COMPLETED'
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                : task.status === 'IN_PROGRESS'
                  ? <AlertCircle className="w-4 h-4 text-blue-500" />
                  : <Circle className="w-4 h-4 text-slate-300" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{task.title}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {task.project?.client && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
                    style={{ background: task.project.client.color || '#17394f' }}>
                    {task.project.client.name}
                  </span>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[task.status]}`}>{STATUS_LABEL[task.status]}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => handleStartTimer(task.id, task.title, task.project?.id)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#17394f]/10 text-[#17394f] transition-colors" title="Iniciar timer">
                <Play className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ),
      })
    })
  }

  if (filters.shoots) {
    (data?.shoots ?? []).forEach(shoot => {
      items.push({
        key: 'shoot-' + shoot.id, sort: 1,
        el: (
          <Link href={`/logistica/rodajes/${shoot.id}`} className="block bg-white border border-amber-200 rounded-xl px-4 py-3 hover:shadow-sm transition-shadow">
            <div className="flex items-start gap-3">
              <Film className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{shoot.title}</p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {shoot.location && <span className="text-xs text-slate-400 flex items-center gap-0.5"><MapPin className="w-3 h-3" />{shoot.location.name}</span>}
                  {shoot.client && <span className="text-xs text-slate-400">{shoot.client.name}</span>}
                  <span className="text-xs text-slate-400 flex items-center gap-0.5"><Users className="w-3 h-3" />{shoot.crew.length} crew</span>
                </div>
              </div>
            </div>
          </Link>
        ),
      })
    })
  }

  if (filters.pieces) {
    (data?.contentPieces ?? []).forEach(piece => {
      const sort = piece.scheduledTime ? timeToMinutes(piece.scheduledTime) : 9998
      items.push({
        key: 'piece-' + piece.id, sort,
        el: (
          <Link href="/content/calendar" className="block bg-white border border-emerald-200 rounded-xl px-4 py-3 hover:shadow-sm transition-shadow">
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{piece.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {piece.scheduledTime && <span className="text-xs text-slate-400 flex items-center gap-0.5"><Clock className="w-3 h-3" />{formatTime(piece.scheduledTime)}</span>}
                  {piece.client && <span className="text-xs text-slate-400">{piece.client.name}</span>}
                </div>
              </div>
            </div>
          </Link>
        ),
      })
    })
  }

  items.sort((a, b) => a.sort - b.sort)

  const hasItems = items.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {header}

        {hasItems ? (
          <div className="space-y-2">
            {items.map(item => <div key={item.key}>{item.el}</div>)}
          </div>
        ) : (
          <div className="text-center py-20 text-slate-400">
            <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin actividades para este día</p>
            <button onClick={() => setNewBlockModal({ open: true })} className="mt-4 text-sm text-[#17394f] font-medium hover:underline">
              + Crear primer bloque
            </button>
          </div>
        )}
      </div>

      {newBlockModal.open && (
        <NewBlockModal
          date={date}
          linkedTask={newBlockModal.linked?.task}
          linkedShoot={newBlockModal.linked?.shoot}
          linkedPiece={newBlockModal.linked?.piece}
          onSave={handleBlockSaved}
          onClose={() => setNewBlockModal({ open: false })}
        />
      )}
    </div>
  )
}
