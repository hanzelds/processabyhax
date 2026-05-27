'use client'

import { useState } from 'react'
import { MapPin, Phone, Mail, User, DollarSign, Calendar, X, ChevronLeft, Clapperboard } from 'lucide-react'
import { LocationItem } from '@/types'
import { LogisticaTabs } from '@/components/logistica/LogisticaTabs'
import Link from 'next/link'

const SHOOT_STATUS_BADGE: Record<string, string> = {
  DRAFT:       'bg-slate-100 text-slate-500',
  CONFIRMED:   'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  COMPLETED:   'bg-emerald-50 text-emerald-700',
  CANCELLED:   'bg-red-50 text-red-500',
}
const SHOOT_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', CONFIRMED: 'Confirmado', IN_PROGRESS: 'En rodaje', COMPLETED: 'Completado', CANCELLED: 'Cancelado',
}

interface Shoot { id: string; title: string; shootDate: string; status: string }

export function LocacionDetailClient({
  location,
  userRole,
}: {
  location: LocationItem & { shoots: Shoot[] }
  userRole: string
}) {
  const [lightbox, setLightbox] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-gray-50">
      <LogisticaTabs />
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Back */}
        <Link href="/logistica/locaciones" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mb-4 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Locaciones
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: info */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-[#17394f]" />
                <h1 className="text-base font-semibold text-slate-900">{location.name}</h1>
              </div>
              {location.address && <p className="text-sm text-slate-500 mb-4">{location.address}</p>}

              <div className="space-y-3 text-sm">
                {location.contactName && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{location.contactName}</span>
                  </div>
                )}
                {location.contactPhone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <a href={`tel:${location.contactPhone}`} className="hover:text-[#17394f] transition-colors">{location.contactPhone}</a>
                  </div>
                )}
                {location.contactEmail && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <a href={`mailto:${location.contactEmail}`} className="hover:text-[#17394f] transition-colors truncate">{location.contactEmail}</a>
                  </div>
                )}
                {location.costPerDay && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>RD${Number(location.costPerDay).toLocaleString()} / día</span>
                  </div>
                )}
              </div>

              {location.notes && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-1 font-medium">Notas</p>
                  <p className="text-sm text-slate-600">{location.notes}</p>
                </div>
              )}
            </div>

            {/* Shoots list */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Clapperboard className="w-3.5 h-3.5 text-slate-400" />
                Rodajes ({location.shoots?.length ?? 0})
              </h2>
              {(location.shoots?.length ?? 0) === 0 ? (
                <p className="text-xs text-slate-400">Sin rodajes en esta locación</p>
              ) : (
                <div className="space-y-2">
                  {location.shoots.map(s => (
                    <Link key={s.id} href={`/logistica/rodajes/${s.id}`} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors group">
                      <div className="flex items-center gap-2 min-w-0">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-slate-700 font-medium group-hover:text-[#17394f] transition-colors truncate">{s.title}</p>
                          <p className="text-xs text-slate-400">{new Date(s.shootDate).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2 ${SHOOT_STATUS_BADGE[s.status] ?? 'bg-slate-100 text-slate-500'}`}>{SHOOT_STATUS_LABEL[s.status] ?? s.status}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: photo gallery */}
          <div className="lg:col-span-2">
            {(location.photoUrls?.length ?? 0) === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl h-48 flex items-center justify-center">
                <p className="text-sm text-slate-400">Sin fotos</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {location.photoUrls.map((url, i) => (
                  <button key={i} onClick={() => setLightbox(url)} className="aspect-video rounded-xl overflow-hidden bg-slate-100 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#17394f]">
                    <img src={url} alt={`${location.name} ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors" onClick={() => setLightbox(null)}>
            <X className="w-5 h-5" />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
