'use client'

import { useState, useEffect } from 'react'
import { UserPermissionRow } from '@/types'
import { api } from '@/lib/api'

interface Props { userId: string }

export function UserPermissionsTab({ userId }: Props) {
  const [rows, setRows]     = useState<UserPermissionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<UserPermissionRow[]>(`/api/users/${userId}/permissions`)
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  async function addOverride(permission: string, granted: boolean) {
    await api.post(`/api/users/${userId}/permissions`, { permission, granted })
    setRows(r => r.map(row => row.permission === permission ? { ...row, override: granted, effective: granted } : row))
  }

  async function removeOverride(permission: string) {
    await api.delete(`/api/users/${userId}/permissions/${permission}`)
    setRows(r => r.map(row => row.permission === permission ? { ...row, override: null, effective: row.byRole } : row))
  }

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">Cargando permisos…</div>

  // Group by module
  const modules = Array.from(new Set(rows.map(r => r.module)))

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-slate-500">
        Los permisos con override sobreescriben el comportamiento del rol. Los cambios son inmediatos.
      </p>
      {modules.map(mod => (
        <div key={mod} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{mod}</h4>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-2 text-xs text-slate-400 font-medium">Permiso</th>
                <th className="text-center px-3 py-2 text-xs text-slate-400 font-medium">Por rol</th>
                <th className="text-center px-3 py-2 text-xs text-slate-400 font-medium">Override</th>
                <th className="text-center px-3 py-2 text-xs text-slate-400 font-medium">Efectivo</th>
                <th className="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.filter(r => r.module === mod).map(row => (
                <tr key={row.permission} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 text-slate-700">{row.label}</td>
                  <td className="px-3 py-3 text-center">{row.byRole ? '✅' : '❌'}</td>
                  <td className="px-3 py-3 text-center">
                    {row.override === null ? <span className="text-slate-300">—</span>
                      : row.override ? <span className="text-emerald-600 font-medium">✅ Otorgado</span>
                      : <span className="text-red-500 font-medium">🚫 Denegado</span>
                    }
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${row.effective ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {row.effective ? 'Sí' : 'No'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {row.override === null ? (
                        <>
                          <button onClick={() => addOverride(row.permission, true)}
                            className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">+Otorgar</button>
                          <button onClick={() => addOverride(row.permission, false)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium">+Denegar</button>
                        </>
                      ) : (
                        <button onClick={() => removeOverride(row.permission)}
                          className="text-xs text-slate-400 hover:text-slate-600 font-medium">Remover</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
