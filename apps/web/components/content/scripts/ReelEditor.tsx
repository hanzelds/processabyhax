'use client'

import { useState } from 'react'
import { ReelScene } from '@/types'
import { Plus, Trash2, GripVertical, Film, Volume2, Type, Music, Clapperboard } from 'lucide-react'

function genId() { return Math.random().toString(36).slice(2) }

function emptyScene(order: number): ReelScene {
  return { id: genId(), order, sceneType: '', duration: '0:05', visual: '', audio: '', textOverlay: '', music: '' }
}

const SCENE_TYPES: { value: string; label: string; color: string; bg: string }[] = [
  { value: 'hook',          label: 'Hook',          color: '#dc2626', bg: 'rgba(220,38,38,0.08)'   },
  { value: 'intro',         label: 'Intro',         color: '#d97706', bg: 'rgba(217,119,6,0.08)'   },
  { value: 'desarrollo',    label: 'Desarrollo',    color: '#2563eb', bg: 'rgba(37,99,235,0.08)'   },
  { value: 'tomas_aereas',  label: 'Tomas Aéreas',  color: '#0891b2', bg: 'rgba(8,145,178,0.08)'   },
  { value: 'transicion',    label: 'Transición',    color: '#7c3aed', bg: 'rgba(124,58,237,0.08)'  },
  { value: 'cta',           label: 'CTA',           color: '#db2777', bg: 'rgba(219,39,119,0.08)'  },
  { value: 'cierre',        label: 'Cierre',        color: '#059669', bg: 'rgba(5,150,105,0.08)'   },
  { value: 'outro',         label: 'Outro',         color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
]

const TYPE_MAP = Object.fromEntries(SCENE_TYPES.map(t => [t.value, t]))

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
    onChange([...scenes, emptyScene(scenes.length + 1)])
  }

  function removeScene(id: string) {
    onChange(scenes.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i + 1 })))
  }

  function updateScene(id: string, field: keyof ReelScene, value: string) {
    onChange(scenes.map(s => s.id === id ? { ...s, [field]: value } : s))
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

  return (
    <div className="re-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap');

        .re-root {
          --bg:       #ffffff;
          --surface:  #f8fafc;
          --border:   #e2e8f0;
          --border2:  #cbd5e1;
          --green:    #059669;
          --green-lo: rgba(5,150,105,0.06);
          --green-md: rgba(5,150,105,0.12);
          --text:     #1e293b;
          --muted:    #64748b;
          --subtle:   #e2e8f0;
          background: var(--bg);
          min-height: 100%;
          padding: 32px 24px 48px;
        }

        /* ── Brief context ─────────────────────────────── */
        .re-brief {
          position: relative;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px 22px 20px 26px;
          margin-bottom: 32px;
          overflow: hidden;
        }
        .re-brief::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: linear-gradient(to bottom, var(--green), transparent);
        }

        .re-brief-eyebrow {
          font-family: 'Syne', sans-serif;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--green);
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 10px;
        }

        .re-brief-concept {
          font-size: 14px;
          line-height: 1.75;
          color: #94a3b8;
        }

        .re-brief-sep {
          height: 1px;
          background: var(--border);
          margin: 14px 0;
        }

        .re-brief-sub {
          font-family: 'Syne', sans-serif;
          font-size: 8.5px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 7px;
        }

        .re-brief-script {
          font-size: 13px;
          line-height: 1.7;
          color: #64748b;
        }

        /* ── Column headers ────────────────────────────── */
        .re-headers {
          display: grid;
          grid-template-columns: 16px 66px 70px 1fr 1fr 1fr 1fr 22px;
          gap: 0 10px;
          padding: 0 8px 10px;
          border-bottom: 1px solid var(--border2);
          margin-bottom: 6px;
          max-width: 1100px;
          margin-left: auto;
          margin-right: auto;
        }

        .re-hcell {
          font-family: 'Syne', sans-serif;
          font-size: 8.5px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--muted);
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .re-hcell.center { justify-content: center; }

        /* ── Scene row ─────────────────────────────────── */
        .re-scene {
          display: grid;
          grid-template-columns: 16px 66px 70px 1fr 1fr 1fr 1fr 22px;
          gap: 0 12px;
          padding: 16px 10px;
          border-top: 1px solid var(--border);
          align-items: start;
          transition: background 0.12s;
          cursor: default;
          max-width: 1100px;
          margin-left: auto;
          margin-right: auto;
        }
        .re-scene:last-child { border-bottom: 1px solid var(--border); }
        .re-scene:hover      { background: var(--surface); }
        .re-scene.over       { background: var(--green-lo); }
        .re-scene.dragging   { opacity: 0.25; }

        /* ── Grip ──────────────────────────────────────── */
        .re-grip {
          color: var(--subtle);
          cursor: grab;
          opacity: 0;
          transition: opacity 0.12s, color 0.12s;
          margin-top: 5px;
        }
        .re-scene:hover .re-grip { opacity: 1; }
        .re-scene:hover .re-grip:hover { color: var(--green); }

        /* ── Scene number ───────────────────────────────── */
        .re-num-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
        }
        .re-num {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          background: var(--green-lo);
          border: 1px solid rgba(5,150,105,0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 400;
          color: var(--green);
          flex-shrink: 0;
          transition: background 0.12s, border-color 0.12s;
        }
        .re-scene:hover .re-num {
          background: var(--green-md);
          border-color: rgba(5,150,105,0.35);
        }

        /* ── Scene type select ──────────────────────────── */
        .re-type {
          font-family: 'Syne', sans-serif;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          border-radius: 4px;
          padding: 2px 4px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--muted);
          cursor: pointer;
          outline: none;
          width: 58px;
          text-align: center;
          appearance: none;
          -webkit-appearance: none;
          transition: border-color 0.12s;
        }
        .re-type:focus { border-color: var(--green); }

        /* ── Duration ───────────────────────────────────── */
        .re-dur {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          font-weight: 400;
          color: var(--green);
          background: transparent;
          border: none;
          border-bottom: 1px solid var(--border2);
          outline: none;
          text-align: center;
          width: 62px;
          display: block;
          margin: 0 auto;
          padding: 3px 4px;
          transition: border-color 0.15s;
          letter-spacing: 0.06em;
        }
        .re-dur:focus { border-bottom-color: var(--green); }
        .re-dur:read-only { color: var(--muted); opacity: 0.7; cursor: default; }

        /* ── Textareas ───────────────────────────────────── */
        .re-cell {
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          width: 100%;
          font-size: 12.5px;
          line-height: 1.65;
          color: var(--text);
          padding: 0;
          font-family: inherit;
        }
        .re-cell::placeholder { color: #94a3b8; }
        .re-cell:focus { color: #0f172a; }
        .re-cell:read-only { cursor: default; color: var(--muted); }

        /* ── Delete ─────────────────────────────────────── */
        .re-del {
          background: none;
          border: none;
          cursor: pointer;
          padding: 3px;
          border-radius: 4px;
          color: var(--subtle);
          display: flex;
          align-items: center;
          opacity: 0;
          transition: opacity 0.12s, color 0.12s, background 0.12s;
          margin-top: 3px;
        }
        .re-scene:hover .re-del { opacity: 1; }
        .re-del:hover { color: #f87171; background: rgba(248,113,113,0.1); }

        /* ── Add scene ──────────────────────────────────── */
        .re-add {
          width: 100%;
          max-width: 1100px;
          margin: 10px auto 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          background: transparent;
          border: 1px dashed var(--border2);
          border-radius: 8px;
          color: var(--muted);
          font-family: 'Syne', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.14s;
        }
        .re-add:hover {
          border-color: var(--green);
          color: var(--green);
          background: var(--green-lo);
        }

        /* ── Empty state ────────────────────────────────── */
        .re-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 0;
          gap: 12px;
          color: var(--subtle);
        }
        .re-empty-label {
          font-family: 'Syne', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        /* ── Row entry animation ────────────────────────── */
        @keyframes re-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .re-scene { animation: re-in 0.18s ease-out both; }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Brief context */}
        {(brief.concept || brief.script) && (
          <div className="re-brief">
            <div className="re-brief-eyebrow">
              <Clapperboard style={{ width: 10, height: 10 }} />
              Concepto del brief
            </div>
            {brief.concept && <p className="re-brief-concept">{brief.concept}</p>}
            {brief.script && (
              <>
                <div className="re-brief-sep" />
                <p className="re-brief-sub">Guion del brief</p>
                <p className="re-brief-script">{brief.script}</p>
              </>
            )}
          </div>
        )}

        {/* Column headers */}
        <div className="re-headers">
          <div />
          <div className="re-hcell center"># / Tipo</div>
          <div className="re-hcell center">Dur.</div>
          <div className="re-hcell"><Film style={{ width: 9, height: 9 }} /> Visual</div>
          <div className="re-hcell"><Volume2 style={{ width: 9, height: 9 }} /> Audio / VO</div>
          <div className="re-hcell"><Type style={{ width: 9, height: 9 }} /> Texto</div>
          <div className="re-hcell"><Music style={{ width: 9, height: 9 }} /> Música</div>
          <div />
        </div>

        {/* Scene rows */}
        {scenes.map((scene, idx) => (
          <div
            key={scene.id}
            draggable={!readOnly}
            onDragStart={() => onDragStart(idx)}
            onDragOver={e => onDragOver(e, idx)}
            onDrop={onDrop}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
            className={[
              're-scene',
              overIdx === idx && dragIdx !== idx ? 'over' : '',
              dragIdx === idx ? 'dragging' : '',
            ].join(' ')}
            style={{ animationDelay: `${idx * 0.03}s` }}
          >
            {/* Grip */}
            <div>
              {!readOnly && <GripVertical className="re-grip" style={{ width: 13, height: 13 }} />}
            </div>

            {/* Scene number + type */}
            <div className="re-num-wrap">
              <div
                className="re-num"
                style={scene.sceneType && TYPE_MAP[scene.sceneType] ? {
                  background: TYPE_MAP[scene.sceneType].bg,
                  border: `1px solid ${TYPE_MAP[scene.sceneType].color}44`,
                  color: TYPE_MAP[scene.sceneType].color,
                } : {}}
              >
                {scene.order}
              </div>
              <select
                value={scene.sceneType ?? ''}
                onChange={e => updateScene(scene.id, 'sceneType' as any, e.target.value)}
                disabled={readOnly}
                className="re-type"
                style={scene.sceneType && TYPE_MAP[scene.sceneType] ? {
                  background: TYPE_MAP[scene.sceneType].bg,
                  borderColor: `${TYPE_MAP[scene.sceneType].color}55`,
                  color: TYPE_MAP[scene.sceneType].color,
                } : {}}
              >
                <option value="">— tipo</option>
                {SCENE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
              <input
                value={scene.duration}
                onChange={e => updateScene(scene.id, 'duration', e.target.value)}
                readOnly={readOnly}
                placeholder="0:00"
                className="re-dur"
              />
            </div>

            {/* Visual */}
            <textarea
              value={scene.visual}
              onChange={e => updateScene(scene.id, 'visual', e.target.value)}
              readOnly={readOnly}
              placeholder="¿Qué se ve en cámara?"
              rows={3}
              className="re-cell"
            />

            {/* Audio */}
            <textarea
              value={scene.audio}
              onChange={e => updateScene(scene.id, 'audio', e.target.value)}
              readOnly={readOnly}
              placeholder="Voz en off, diálogo..."
              rows={3}
              className="re-cell"
            />

            {/* Text overlay */}
            <textarea
              value={scene.textOverlay}
              onChange={e => updateScene(scene.id, 'textOverlay', e.target.value)}
              readOnly={readOnly}
              placeholder="Texto en pantalla..."
              rows={3}
              className="re-cell"
            />

            {/* Music */}
            <textarea
              value={scene.music}
              onChange={e => updateScene(scene.id, 'music', e.target.value)}
              readOnly={readOnly}
              placeholder="Canción / efecto..."
              rows={3}
              className="re-cell"
            />

            {/* Delete */}
            {!readOnly ? (
              <button onClick={() => removeScene(scene.id)} className="re-del">
                <Trash2 style={{ width: 12, height: 12 }} />
              </button>
            ) : <div />}
          </div>
        ))}

        {/* Add scene */}
        {!readOnly && (
          <button onClick={addScene} className="re-add">
            <Plus style={{ width: 12, height: 12 }} />
            Agregar escena
          </button>
        )}

        {/* Empty read-only */}
        {scenes.length === 0 && readOnly && (
          <div className="re-empty">
            <Film style={{ width: 26, height: 26, opacity: 0.3 }} />
            <span className="re-empty-label">Sin escenas aún</span>
          </div>
        )}

      </div>
    </div>
  )
}
