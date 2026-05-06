'use client'

import { useState } from 'react'
import { CarouselSlide } from '@/types'
import { Plus, Trash2, GripVertical, LayoutTemplate } from 'lucide-react'

function genId() { return Math.random().toString(36).slice(2) }

function emptySlide(order: number): CarouselSlide {
  return { id: genId(), order, headline: '', body: '', imageDesc: '', cta: '' }
}

interface Props {
  slides: CarouselSlide[]
  onChange: (slides: CarouselSlide[]) => void
  readOnly: boolean
  brief: { concept?: string | null; script?: string | null }
}

export function CarouselEditor({ slides, onChange, readOnly, brief }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  function addSlide() {
    const next = [...slides, emptySlide(slides.length + 1)]
    onChange(next)
    setActiveIdx(next.length - 1)
  }

  function removeSlide(id: string) {
    const next = slides.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i + 1 }))
    onChange(next)
    setActiveIdx(Math.max(0, Math.min(activeIdx, next.length - 1)))
  }

  function updateSlide(id: string, field: keyof CarouselSlide, value: string) {
    onChange(slides.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  function onDragStart(idx: number) { setDragIdx(idx) }
  function onDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setOverIdx(idx) }
  function onDrop() {
    if (dragIdx === null || overIdx === null || dragIdx === overIdx) {
      setDragIdx(null); setOverIdx(null); return
    }
    const next = [...slides]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(overIdx, 0, moved)
    onChange(next.map((s, i) => ({ ...s, order: i + 1 })))
    setActiveIdx(overIdx)
    setDragIdx(null); setOverIdx(null)
  }

  const active = slides[activeIdx]

  return (
    <div className="h-full flex gap-0">
      {/* Slide thumbnails sidebar */}
      <div className="w-48 flex-shrink-0 border-r border-slate-100 bg-white overflow-y-auto py-4 px-2">
        {/* Brief context */}
        {(brief.concept || brief.script) && (
          <div className="mb-3 bg-[#17394f]/5 border border-[#17394f]/10 rounded-lg p-2.5">
            <p className="text-xs font-semibold text-[#17394f] mb-1">Concepto</p>
            {brief.concept && <p className="text-xs text-slate-600 line-clamp-3">{brief.concept}</p>}
          </div>
        )}

        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1 mb-2">Slides</p>
        <div className="space-y-1.5">
          {slides.map((slide, idx) => (
            <div
              key={slide.id}
              draggable={!readOnly}
              onDragStart={() => onDragStart(idx)}
              onDragOver={e => onDragOver(e, idx)}
              onDrop={onDrop}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
              onClick={() => setActiveIdx(idx)}
              className={`group relative rounded-lg p-2 cursor-pointer transition-all border ${
                activeIdx === idx ? 'bg-[#17394f] border-[#17394f] text-white' :
                overIdx === idx && dragIdx !== idx ? 'border-[#17394f]/40 bg-[#17394f]/5' :
                'border-slate-200 hover:border-slate-300 bg-white'
              } ${dragIdx === idx ? 'opacity-40' : ''}`}
            >
              <div className="flex items-center gap-1.5">
                {!readOnly && <GripVertical className={`w-3 h-3 flex-shrink-0 ${activeIdx === idx ? 'text-white/60' : 'text-slate-300'}`} />}
                <span className={`text-xs font-bold flex-shrink-0 ${activeIdx === idx ? 'text-white' : 'text-[#17394f]'}`}>
                  {idx + 1}
                </span>
                <p className={`text-xs truncate flex-1 ${activeIdx === idx ? 'text-white/80' : 'text-slate-500'}`}>
                  {slide.headline || <span className="italic opacity-60">Sin título</span>}
                </p>
              </div>
            </div>
          ))}
        </div>

        {!readOnly && (
          <button
            onClick={addSlide}
            className="mt-2 w-full flex items-center justify-center gap-1 border-dashed border-2 border-slate-200 rounded-lg py-2 text-xs text-slate-400 hover:border-[#17394f]/30 hover:text-[#17394f] transition-colors"
          >
            <Plus className="w-3 h-3" />
            Slide
          </button>
        )}
      </div>

      {/* Slide editor */}
      <div className="flex-1 overflow-auto bg-slate-50">
        {!active ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-300">
            <LayoutTemplate className="w-10 h-10 mb-3" />
            <p className="text-sm">Agrega el primer slide</p>
            {!readOnly && (
              <button onClick={addSlide} className="mt-3 bg-[#17394f] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#17394f]/90">
                Agregar slide
              </button>
            )}
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Slide {active.order}</h3>
              {!readOnly && (
                <button onClick={() => removeSlide(active.id)} className="text-slate-400 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Titular / Título</label>
              <input
                value={active.headline}
                onChange={e => updateSlide(active.id, 'headline', e.target.value)}
                readOnly={readOnly}
                placeholder="Frase principal del slide..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#17394f]/20 bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Cuerpo / Copy</label>
              <textarea
                value={active.body}
                onChange={e => updateSlide(active.id, 'body', e.target.value)}
                readOnly={readOnly}
                placeholder="Texto del cuerpo del slide..."
                rows={4}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#17394f]/20 bg-white resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Descripción de imagen / diseño</label>
              <textarea
                value={active.imageDesc}
                onChange={e => updateSlide(active.id, 'imageDesc', e.target.value)}
                readOnly={readOnly}
                placeholder="¿Qué imagen o diseño va en este slide?"
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#17394f]/20 bg-white resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                CTA {active.order === slides.length ? '(último slide)' : ''}
              </label>
              <input
                value={active.cta}
                onChange={e => updateSlide(active.id, 'cta', e.target.value)}
                readOnly={readOnly}
                placeholder='Ej: "Síguenos para más tips"'
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#17394f]/20 bg-white"
              />
            </div>

            {/* Navigation */}
            <div className="flex gap-2 pt-2">
              {activeIdx > 0 && (
                <button onClick={() => setActiveIdx(activeIdx - 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                  ← Slide anterior
                </button>
              )}
              {activeIdx < slides.length - 1 && (
                <button onClick={() => setActiveIdx(activeIdx + 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 ml-auto">
                  Siguiente slide →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
