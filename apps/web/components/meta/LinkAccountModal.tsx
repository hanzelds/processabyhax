'use client'

import { useState, useEffect } from 'react'
import { MetaAdAccount, MetaPage, Client } from '@/types'
import { api } from '@/lib/api'
import { X, AlertCircle, Info } from 'lucide-react'

interface Props {
  clients: Pick<Client, 'id' | 'name'>[]
  onClose: () => void
  onLinked: () => void
}

export function LinkAccountModal({ clients, onClose, onLinked }: Props) {
  const [accounts, setAccounts]         = useState<MetaAdAccount[]>([])
  const [pages, setPages]               = useState<MetaPage[]>([])
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [manualMode, setManualMode]     = useState(false)
  const [clientId, setClientId]         = useState('')
  const [adAccountId, setAdAccountId]   = useState('')
  const [adAccountName, setAdAccountName] = useState('')
  const [pageId, setPageId]             = useState('')
  const [pageName, setPageName]         = useState('')
  const [error, setError]               = useState('')
  const [fetchWarning, setFetchWarning] = useState('')

  useEffect(() => {
    Promise.allSettled([
      api.get<MetaAdAccount[]>('/api/meta/accounts'),
      api.get<MetaPage[]>('/api/meta/pages'),
    ]).then(([acctRes, pageRes]) => {
      if (acctRes.status === 'fulfilled') {
        setAccounts(acctRes.value)
      } else {
        setManualMode(true)
        setFetchWarning('El token configurado es un Page Token — ingresa el ID de la cuenta manualmente. Para obtenerlo, ve a Meta Ads Manager → Configuración de cuenta.')
      }
      if (pageRes.status === 'fulfilled') setPages(pageRes.value)
    }).finally(() => setLoading(false))
  }, [])

  async function handleSubmit() {
    if (!clientId) { setError('Selecciona un cliente'); return }
    const finalAdAccountId   = manualMode ? adAccountId.trim().replace(/^act_/, '') : adAccountId
    const finalAdAccountName = manualMode ? (adAccountName.trim() || finalAdAccountId) : (accounts.find(a => a.id === adAccountId)?.name || adAccountId)
    const finalPageId        = manualMode ? (pageId.trim() || null) : (pageId || null)
    const finalPageName      = manualMode ? (pageName.trim() || null) : (pages.find(p => p.id === pageId)?.name || null)

    if (!finalAdAccountId) { setError('Ingresa el ID de la cuenta publicitaria'); return }

    setSaving(true)
    try {
      await api.post(`/api/meta/clients/${clientId}/link`, {
        adAccountId:   `act_${finalAdAccountId}`,
        adAccountName: finalAdAccountName,
        pageId:        finalPageId,
        pageName:      finalPageName,
      })
      onLinked()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const selectClass = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
  const inputClass  = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 placeholder:text-slate-300"

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">Vincular cuenta de Meta</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Conectando con Meta…</p>
        ) : (
          <div className="space-y-4">

            {/* Warning: Page Token */}
            {fetchWarning && (
              <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">{fetchWarning}</p>
              </div>
            )}

            {/* Toggle manual/auto */}
            {accounts.length > 0 && (
              <button onClick={() => setManualMode(m => !m)}
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:underline">
                <Info className="w-3 h-3" />
                {manualMode ? 'Seleccionar de la lista' : 'Ingresar ID manualmente'}
              </button>
            )}

            {/* Cliente */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Cliente de Processa</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)} className={selectClass}>
                <option value="">Seleccionar cliente…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Ad Account */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Cuenta publicitaria</label>
              {manualMode ? (
                <div className="space-y-2">
                  <input value={adAccountId} onChange={e => setAdAccountId(e.target.value)}
                    placeholder="ID de cuenta (ej: 123456789)" className={inputClass} />
                  <input value={adAccountName} onChange={e => setAdAccountName(e.target.value)}
                    placeholder="Nombre de la cuenta (ej: Vistagolf Ads)" className={inputClass} />
                  <p className="text-xs text-slate-400">Encuéntralo en: Meta Ads Manager → ⚙ Configuración de la cuenta</p>
                </div>
              ) : (
                <select value={adAccountId} onChange={e => setAdAccountId(e.target.value)} className={selectClass}>
                  <option value="">Seleccionar cuenta…</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
                </select>
              )}
            </div>

            {/* Página */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Página de Facebook <span className="text-slate-400">(opcional)</span>
              </label>
              {manualMode ? (
                <div className="space-y-2">
                  <input value={pageId} onChange={e => setPageId(e.target.value)}
                    placeholder="ID de página (ej: 368573603001915)" className={inputClass} />
                  <input value={pageName} onChange={e => setPageName(e.target.value)}
                    placeholder="Nombre de la página" className={inputClass} />
                </div>
              ) : (
                <select value={pageId} onChange={e => setPageId(e.target.value)} className={selectClass}>
                  <option value="">Sin página vinculada</option>
                  {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>

            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={onClose}
                className="flex-1 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors">
                {saving ? 'Vinculando…' : 'Vincular'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
