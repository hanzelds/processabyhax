import { Metadata } from 'next'
import { PublicDocClient } from './PublicDocClient'

interface Props {
  params: Promise<{ token: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Documento — Processa by Hax' }
}

interface PublicDoc {
  id: string
  title: string
  icon: string | null
  content: unknown[]
  fullWidth: boolean
  allowComments: boolean
  shareToken: string
  updatedAt: string
}

async function getDoc(token: string): Promise<PublicDoc | { error: string; expired?: boolean }> {
  const apiUrl = process.env.API_INTERNAL_URL || 'http://localhost:4100'
  try {
    const res = await fetch(`${apiUrl}/api/docs/public/${token}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'No disponible', expired: res.status === 410 }
    return data as PublicDoc
  } catch {
    return { error: 'Error de conexión' }
  }
}

export default async function PublicDocPage({ params }: Props) {
  const { token } = await params
  const data = await getDoc(token)

  if ('error' in data) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">{data.expired ? '⏰' : '🔒'}</span>
          </div>
          <h1 className="text-xl font-bold text-[#111111] mb-2">
            {data.expired ? 'Este enlace expiró' : 'Enlace no válido'}
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            {data.expired
              ? 'El enlace de este documento ha expirado. Solicita uno nuevo a tu equipo Hax.'
              : 'No encontramos un documento asociado a este enlace.'}
          </p>
        </div>
      </div>
    )
  }

  return <PublicDocClient doc={data} token={token} />
}
