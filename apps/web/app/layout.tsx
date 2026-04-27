import type { Metadata } from 'next'
import { Bebas_Neue, DM_Mono, DM_Sans } from 'next/font/google'
import './globals.css'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
})

const dmMono = DM_Mono({
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

const dmSans = DM_Sans({
  weight: ['300', '400', '500'],
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Processa — Hax',
  description: 'Sistema operativo interno de Hax',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover', // iOS notch support
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Processa',
  },
  formatDetection: { telephone: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`h-full ${bebasNeue.variable} ${dmMono.variable} ${dmSans.variable}`}>
      <body className="h-full">{children}</body>
    </html>
  )
}
