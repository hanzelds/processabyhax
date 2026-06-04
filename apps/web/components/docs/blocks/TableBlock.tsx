'use client'

import { useState, useRef, useCallback } from 'react'
import { DocBlock } from '@/types'
import { Plus, Trash2 } from 'lucide-react'

interface Props {
  block: DocBlock
  readOnly: boolean
  blockRef: (el: HTMLElement | null) => void
  onUpdate: (updates: Partial<DocBlock['content']>) => void
  onFocus: () => void
}

export function TableBlock({ block, readOnly, blockRef, onUpdate, onFocus }: Props) {
  const headers = block.content.headers ?? ['']
  const rows    = block.content.rows    ?? [['']]
  const [hoveredCol, setHoveredCol] = useState<number | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  const updateCell = useCallback((rowIdx: number, colIdx: number, value: string) => {
    const newRows = rows.map((r, ri) =>
      ri === rowIdx ? r.map((c, ci) => ci === colIdx ? value : c) : r
    )
    onUpdate({ rows: newRows })
  }, [rows, onUpdate])

  const updateHeader = useCallback((colIdx: number, value: string) => {
    const newHeaders = headers.map((h, i) => i === colIdx ? value : h)
    onUpdate({ headers: newHeaders })
  }, [headers, onUpdate])

  const addRow = useCallback(() => {
    onUpdate({ rows: [...rows, headers.map(() => '')] })
  }, [rows, headers, onUpdate])

  const addColumn = useCallback(() => {
    onUpdate({
      headers: [...headers, `Columna ${headers.length + 1}`],
      rows:    rows.map(r => [...r, '']),
    })
  }, [headers, rows, onUpdate])

  const deleteRow = useCallback((idx: number) => {
    if (rows.length <= 1) return
    onUpdate({ rows: rows.filter((_, i) => i !== idx) })
  }, [rows, onUpdate])

  const deleteColumn = useCallback((idx: number) => {
    if (headers.length <= 1) return
    onUpdate({
      headers: headers.filter((_, i) => i !== idx),
      rows:    rows.map(r => r.filter((_, i) => i !== idx)),
    })
  }, [headers, rows, onUpdate])

  const cellCls = 'border border-slate-200 px-3 py-2 text-sm align-top min-w-[80px]'
  const inputCls = 'w-full bg-transparent outline-none resize-none text-sm leading-snug'

  return (
    <div
      ref={el => { blockRef(el as HTMLElement); (tableRef as React.MutableRefObject<HTMLDivElement | null>).current = el }}
      onFocus={onFocus}
      className="relative my-1 overflow-x-auto"
    >
      <table className="border-collapse w-full text-sm">
        {/* Header row */}
        <thead>
          <tr className="bg-slate-50">
            {headers.map((h, ci) => (
              <th
                key={ci}
                className={`${cellCls} font-semibold text-slate-700 relative group`}
                onMouseEnter={() => setHoveredCol(ci)}
                onMouseLeave={() => setHoveredCol(null)}
              >
                {readOnly ? (
                  <span>{h}</span>
                ) : (
                  <>
                    <input
                      value={h}
                      onChange={e => updateHeader(ci, e.target.value)}
                      className={`${inputCls} font-semibold text-slate-700`}
                      placeholder="Encabezado"
                    />
                    {/* Delete column button */}
                    {!readOnly && hoveredCol === ci && headers.length > 1 && (
                      <button
                        onMouseDown={e => { e.preventDefault(); deleteColumn(ci) }}
                        className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm text-red-400 hover:text-red-600 hover:border-red-300 transition-colors z-10 opacity-0 group-hover:opacity-100"
                        title="Eliminar columna"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </>
                )}
              </th>
            ))}
            {/* Add column button */}
            {!readOnly && (
              <th className="border border-dashed border-slate-200 px-2 py-2 w-8">
                <button
                  onMouseDown={e => { e.preventDefault(); addColumn() }}
                  className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-[#17394f] hover:bg-slate-100 rounded transition-colors"
                  title="Agregar columna"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </th>
            )}
          </tr>
        </thead>

        {/* Data rows */}
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="hover:bg-slate-50/50 group/row transition-colors"
              onMouseEnter={() => setHoveredRow(ri)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              {row.map((cell, ci) => (
                <td key={ci} className={`${cellCls} text-slate-600 relative`}>
                  {readOnly ? (
                    <span>{cell}</span>
                  ) : (
                    <textarea
                      value={cell}
                      onChange={e => {
                        updateCell(ri, ci, e.target.value)
                        // Auto-resize
                        e.target.style.height = 'auto'
                        e.target.style.height = e.target.scrollHeight + 'px'
                      }}
                      className={`${inputCls} text-slate-600 overflow-hidden`}
                      rows={1}
                      placeholder="..."
                      style={{ minHeight: '24px' }}
                    />
                  )}
                </td>
              ))}
              {/* Delete row button */}
              {!readOnly && (
                <td className="border border-transparent px-1 w-8">
                  {hoveredRow === ri && rows.length > 1 && (
                    <button
                      onMouseDown={e => { e.preventDefault(); deleteRow(ri) }}
                      className="w-5 h-5 flex items-center justify-center text-red-300 hover:text-red-500 rounded transition-colors"
                      title="Eliminar fila"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}

          {/* Add row */}
          {!readOnly && (
            <tr>
              <td colSpan={headers.length + 1} className="border border-dashed border-slate-200 px-3 py-1">
                <button
                  onMouseDown={e => { e.preventDefault(); addRow() }}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#17394f] transition-colors"
                >
                  <Plus className="w-3 h-3" /> Agregar fila
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
