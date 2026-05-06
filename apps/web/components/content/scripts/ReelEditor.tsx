'use client'

import { useState } from 'react'
import { ReelScene } from '@/types'
import { Plus, Trash2, GripVertical, Film, Volume2, Type, Music } from 'lucide-react'

function genId() { return Math.random().toString(36).slice(2) }

function emptyScene(order: number): ReelScene {
  return { id: genId(), order, duration: '0:05', visual: '', audio: '', textOverlay: '', music: '' }
}

interface Props {
  scenes: ReelScene[]
  onChange: (scenes: ReelScene[]) => void
  readOnly: boolean
  brief: { concept?: string | null; script?: string | null }
}

export function ReelEditor({ scenes, onChange, readOnly, brief }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  function addScene() {
    const next = [...scenes, emptyScene(scenes.length + 1)]
    onChange(next)
  }

  function removeScene(id: string) {
    const next = scenes.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i + 1 }))
    onChange(next)
  }

  function updateScene(id: string, field: keyof ReelScene, value: string) {
    const next = scenes.map(s => s.id === id ? { ...s, [field]: value } : s)
    onChange(next)
  }

  function onDragStart(idx: number) { setDragIdx(idx) }
  function onDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setOverIdx(idx) }
  function onDrop() {
    if (dragIdx === null || overIdx === null || dragIdx === overIdx) {
      setDragIdx(null); setOverIdx(null); return
    }
    const next = [...scenes]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(overIdx, 0, moved)
    onChange(next.map((s, i) => ({ ...s, order: i + 1 })))
    setDragIdx(null); setOverIdx(null)
  }

  const displayScenes = scenes.length > 0 ? scenes : []

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Brief context */}
      {(brief.concept || brief.script) && (
        <div className="mb-6 bg-[#17394f]/5 border border-[#17394f]/10 rounded-xl p-4">
          <p className="text-xs font-semibold text-[#17394f] uppercase tracking-wide mb-2">Concepto del brief</p>
          {brief.concept && <p className="text-sm text-slate-700 whitespace-pre-line">{brief.concept}</p>}
          {brief.script && (
            <div className="mt-2">
              <p className="text-xs text-slate-400 mb-1">Guion del brief:</p>
              <p className="text-sm text-slate-600 whitespace-pre-line">{brief.script}</p>
            </div>
          )}
        </div>
      )}

      {/* Column headers */}
      <div className="grid gap-2 mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wide px-8"
        style={{ gridTemplateColumns: '56px 80px 1fr 1fr 1fr 1fr 28px' }}>
        <span>#</span>
        <span>Duración</span>
        <span className="flex items-center gap-1"><Film className="w-3 h-3" /> Visual</span>
        <span className="flex items-center gap-1"><Volume2 className="w-3 h-3" /> Audio / VO</span>
        <span className="flex items-center gap-1"><Type className="w-3 h-3" /> Texto</span>
        <span className="flex items-center gap-1"><Music className="w-3 h-3" /> Música</span>
        <span></span>
      </div>

      {/* Scenes */}
      <div className="space-y-2">
        {displayScenes.map((scene, idx) => (
          <div
            key={scene.id}
            draggable={!readOnly}
            onDragStart={() => onDragStart(idx)}
            onDragOver={e => onDragOver(e, idx)}
            onDrop={onDrop}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
            className={`group relative border rounded-xl transition-all ${
              overIdx === idx && dragIdx !== idx ? 'border-[#17394f]/40 bg-[#17394f]/5' : 'border-slate-200 bg-white'
            } ${dragIdx === idx ? 'opacity-50' : ''}`}
          >
            <div className="grid gap-2 p-3 items-start"
              style={{ gridTemplateColumns: '24px 56px 80px 1fr 1fr 1fr 1fr 28px' }}>
              {/* Drag handle */}
              <div className={`cursor-grab mt-2 text-slate-300 ${!readOnly ? 'group-hover:text-slate-400' : ''}`}>
                {!readOnly && <GripVertical className="w-4 h-4" />}
              </div>

              {/* Scene number */}
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#17394f]/10 text-[#17394f] text-xs font-bold mt-1">
                {scene.order}
              </div>

              {/* Duration */}
              <input
                value={scene.duration}
                onChange={e => updateScene(scene.id, 'duration', e.target.value)}
                readOnly={readOnly}
                placeholder="0:05"
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#17394f]/20 text-center font-mono"
              />

              {/* Visual */}
              <textarea
                value={scene.visual}
                onChange={e => updateScene(scene.id, 'visual', e.target.value)}
                readOnly={readOnly}
                placeholder="¿Qué se ve en cámara?"
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#17394f]/20 resize-none"
              />

              {/* Audio */}
              <textarea
                value={scene.audio}
                onChange={e => updateScene(scene.id, 'audio', e.target.value)}
                readOnly={readOnly}
                placeholder="Voz en off, diálogo..."
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#17394f]/20 resize-none"
              />

              {/* Text overlay */}
              <textarea
                value={scene.textOverlay}
                onChange={e => updateScene(scene.id, 'textOverlay', e.target.value)}
                readOnly={readOnly}
                placeholder="Texto en pantalla..."
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#17394f]/20 resize-none"
              />

              {/* Music */}
              <textarea
                value={scene.music}
                onChange={e => updateScene(scene.id, 'music', e.target.value)}
                readOnly={readOnly}
                placeholder="Canción / efecto..."
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#17394f]/20 resize-none"
              />

              {/* Delete */}
              {!readOnly && (
                <button
                  onClick={() => removeScene(scene.id)}
                  className="mt-1.5 text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add scene */}
      {!readOnly && (
        <button
          onClick={addScene}
          className="mt-3 w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-3 text-sm text-slate-400 hover:border-[#17394f]/30 hover:text-[#17394f] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Agregar escena
        </button>
      )}

      {displayScenes.length === 0 && readOnly && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-300">
          <Film className="w-8 h-8 mb-2" />
          <p className="text-sm">Sin escenas aún</p>
        </div>
      )}
    </div>
  )
}
