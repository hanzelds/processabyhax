'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Square, X, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { useTimerStore } from '@/store/timerStore'
import { ActiveTimer } from '@/types'

function formatHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export function TimerWidget() {
  const { active, setActive, clearActive } = useTimerStore()
  const [elapsed, setElapsed]   = useState(0)
  const [open, setOpen]         = useState(false)
  const [desc, setDesc]         = useState('')
  const [loading, setLoading]   = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)
  const loaded     = useRef(false)

  // Load active timer on mount
  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    api.get<ActiveTimer | null>('/api/time/timer/active')
      .then(t => { if (t) setActive(t) })
      .catch(() => {})
  }, [setActive])

  // Tick
  useEffect(() => {
    if (!active?.startedAt) { setElapsed(0); return }
    const base = Math.floor((Date.now() - new Date(active.startedAt).getTime()) / 1000)
    setElapsed(base)
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [active?.startedAt])

  // Close popover on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus input when popover opens
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])

  const handleStart = useCallback(async () => {
    setLoading(true)
    try {
      const timer = await api.post<ActiveTimer>('/api/time/timer/start', { description: desc || undefined })
      setActive(timer)
      setOpen(false)
      setDesc('')
    } catch {
      // already active or error — ignore
    } finally {
      setLoading(false)
    }
  }, [desc, setActive])

  const handleStop = useCallback(async () => {
    setLoading(true)
    try {
      await api.post('/api/time/timer/stop', {})
      clearActive()
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [clearActive])

  const handleDiscard = useCallback(async () => {
    setLoading(true)
    try {
      await api.delete('/api/time/timer/discard')
      clearActive()
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [clearActive])

  if (active) {
    return (
      <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 text-emerald-700">
        <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        <span className="text-xs font-mono font-semibold tabular-nums min-w-[46px]">{formatHMS(elapsed)}</span>
        <button
          onClick={handleStop}
          disabled={loading}
          title="Detener y guardar"
          className="w-5 h-5 flex items-center justify-center rounded bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shrink-0 disabled:opacity-50"
        >
          <Square className="w-2.5 h-2.5 fill-current" />
        </button>
        <button
          onClick={handleDiscard}
          disabled={loading}
          title="Descartar"
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-emerald-100 text-emerald-500 hover:text-emerald-700 transition-colors shrink-0 disabled:opacity-50"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Iniciar cronómetro"
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${open ? 'bg-slate-100 text-[#17394f]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
      >
        <Clock className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-4">
          <p className="text-sm font-semibold text-slate-800 mb-3">Iniciar cronómetro</p>
          <input
            ref={inputRef}
            value={desc}
            onChange={e => setDesc(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleStart(); if (e.key === 'Escape') setOpen(false) }}
            placeholder="¿En qué estás trabajando? (opcional)"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-3 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f] placeholder:text-slate-400"
          />
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#17394f] hover:bg-[#1e4a65] text-white text-sm font-medium rounded-lg py-2 transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Iniciar
          </button>
        </div>
      )}
    </div>
  )
}
