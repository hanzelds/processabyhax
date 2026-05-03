import { Metadata } from 'next'
import { PortalClient } from './PortalClient'
import { PortalData } from './types'

interface Props {
  params: Promise<{ token: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Portal de Contenido — Hax' }
}

async function getPortalData(token: string): Promise<PortalData | { error: string; expired?: boolean }> {
  const apiUrl = process.env.API_INTERNAL_URL || 'http://localhost:4100'
  try {
    const res = await fetch(`${apiUrl}/api/portal/${token}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) return data
    return data as PortalData
  } catch {
    return { error: 'Error de conexión' }
  }
}

export default async function PortalPage({ params }: Props) {
  const { token } = await params
  const data = await getPortalData(token)

  if ('error' in data) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⏰</span>
          </div>
          <h1 className="text-xl font-bold text-[#111111] mb-2">
            {data.expired ? 'Este link venció' : 'Link no válido'}
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            {data.expired
              ? 'El link de acceso a tu portal ha expirado. Solicita uno nuevo a tu equipo Hax.'
              : 'No encontramos un portal asociado a este link. Verifica que hayas copiado el link completo.'}
          </p>
          <p className="mt-6 text-xs text-slate-400">
            Escríbenos a{' '}
            <a href="mailto:hola@hax.com.do" className="text-[#17394f] underline">
              hola@hax.com.do
            </a>
          </p>
        </div>
      </div>
    )
  }

  return <PortalClient data={data} token={token} />
}
