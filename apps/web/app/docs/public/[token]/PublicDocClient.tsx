'use client'

import { DocBlock } from '@/types'

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

// ── Read-only block renderer ──────────────────────────────────────────────────

function detectEmbed(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const loom = url.match(/loom\.com\/share\/([a-f0-9]+)/)
  if (loom) return `https://www.loom.com/embed/${loom[1]}`
  if (url.includes('figma.com')) return `https://www.figma.com/embed?embed_host=processa&url=${encodeURIComponent(url)}`
  const drive = url.match(/drive\.google\.com.*\/d\/([^/]+)/)
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`
  try { new URL(url); return url } catch { return null }
}

function PublicBlock({ block }: { block: DocBlock }) {
  const c = block.content
  switch (block.type) {
    case 'heading_1': return <h1 className="text-3xl font-bold text-slate-900 mt-6 mb-2" dangerouslySetInnerHTML={{ __html: c.html ?? '' }} />
    case 'heading_2': return <h2 className="text-2xl font-bold text-slate-800 mt-5 mb-2" dangerouslySetInnerHTML={{ __html: c.html ?? '' }} />
    case 'heading_3': return <h3 className="text-xl font-semibold text-slate-800 mt-4 mb-1.5" dangerouslySetInnerHTML={{ __html: c.html ?? '' }} />
    case 'paragraph': return <p className="text-slate-700 leading-relaxed my-1.5" dangerouslySetInnerHTML={{ __html: c.html ?? '' }} />
    case 'quote':     return <blockquote className="border-l-4 border-slate-300 pl-4 py-0.5 my-2 text-slate-600 italic" dangerouslySetInnerHTML={{ __html: c.html ?? '' }} />
    case 'callout':   return (
      <div className="flex gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3 my-2">
        <span className="text-lg shrink-0">{c.icon ?? '💡'}</span>
        <div className="text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: c.html ?? '' }} />
      </div>
    )
    case 'bulleted_list': return <ul className="list-disc pl-6 my-2 space-y-1 text-slate-700">{(c.items ?? []).map((i, idx) => <li key={idx} dangerouslySetInnerHTML={{ __html: i }} />)}</ul>
    case 'numbered_list': return <ol className="list-decimal pl-6 my-2 space-y-1 text-slate-700">{(c.items ?? []).map((i, idx) => <li key={idx} dangerouslySetInnerHTML={{ __html: i }} />)}</ol>
    case 'divider':   return <hr className="my-4 border-slate-200" />
    case 'code':      return <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 my-2 overflow-x-auto text-sm"><code>{c.text ?? ''}</code></pre>
    case 'image':     return c.url ? <figure className="my-3"><img src={c.url} alt={c.caption ?? ''} className="w-full rounded-xl" />{c.caption && <figcaption className="text-xs text-slate-400 text-center mt-1">{c.caption}</figcaption>}</figure> : null
    case 'video':     return c.url ? <figure className="my-3"><video src={c.url} controls className="w-full rounded-xl" />{c.caption && <figcaption className="text-xs text-slate-400 text-center mt-1">{c.caption}</figcaption>}</figure> : null
    case 'embed': {
      const iframe = c.url ? detectEmbed(c.url) : null
      return iframe ? <figure className="my-3"><iframe src={iframe} className="w-full aspect-video rounded-xl border border-slate-200" allowFullScreen />{c.caption && <figcaption className="text-xs text-slate-400 text-center mt-1">{c.caption}</figcaption>}</figure> : null
    }
    case 'toggle':    return (
      <details className="my-1.5" open={c.open !== false}>
        <summary className="font-medium text-slate-800 cursor-pointer" dangerouslySetInnerHTML={{ __html: c.html ?? '' }} />
        <div className="ml-5 border-l border-slate-100 pl-3 mt-1 space-y-1">
          {(c.children ?? []).map((child, idx) => <PublicBlock key={idx} block={child} />)}
        </div>
      </details>
    )
    case 'table': {
      const headers = c.headers ?? []
      const rows = c.rows ?? []
      return (
        <div className="overflow-x-auto my-3">
          <table className="border-collapse w-full text-sm">
            <thead><tr className="bg-slate-50">{headers.map((h, i) => <th key={i} className="border border-slate-200 px-3 py-2 font-semibold text-slate-700 text-left">{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((cell, ci) => <td key={ci} className="border border-slate-200 px-3 py-2 text-slate-600">{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )
    }
    default: return null
  }
}

export function PublicDocClient({ doc }: { doc: PublicDoc; token: string }) {
  const blocks = (doc.content ?? []) as DocBlock[]

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="border-b border-slate-100 px-6 py-3 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: '#17394f' }}>
            <span className="text-white text-[10px] font-bold">P</span>
          </div>
          <span className="text-sm font-semibold text-slate-700">Processa <span className="text-slate-400 font-normal">by Hax</span></span>
        </div>
        <span className="text-xs text-slate-400">Documento compartido</span>
      </div>

      {/* Content */}
      <article className={`mx-auto px-6 py-10 ${doc.fullWidth ? 'max-w-5xl' : 'max-w-3xl'}`}>
        <div className="flex items-center gap-3 mb-6">
          {doc.icon && <span className="text-4xl">{doc.icon}</span>}
          <h1 className="text-4xl font-bold text-slate-900">{doc.title}</h1>
        </div>
        {blocks.map((b, idx) => <PublicBlock key={b.id ?? idx} block={b} />)}
      </article>

      <footer className="border-t border-slate-100 px-6 py-6 text-center">
        <p className="text-xs text-slate-400">
          Creado con <span className="font-medium text-slate-500">Processa</span> · HAX Estudio Creativo
        </p>
      </footer>
    </div>
  )
}
