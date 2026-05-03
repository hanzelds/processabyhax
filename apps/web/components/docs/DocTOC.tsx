'use client'

import { useEffect, useState } from 'react'
import { DocBlock } from '@/types'
import { BookOpen } from 'lucide-react'

interface TocEntry {
  id: string
  level: 1 | 2 | 3
  text: string
}

function extractText(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

function extractToc(blocks: DocBlock[]): TocEntry[] {
  return blocks
    .filter(b => b.type === 'heading_1' || b.type === 'heading_2' || b.type === 'heading_3')
    .map(b => ({
      id: b.id,
      level: (b.type === 'heading_1' ? 1 : b.type === 'heading_2' ? 2 : 3) as 1 | 2 | 3,
      text: extractText(b.content.html ?? ''),
    }))
    .filter(e => e.text.length > 0)
}

interface Props {
  blocks: DocBlock[]
}

export function DocTOC({ blocks }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const entries = extractToc(blocks)

  // Intersection observer to track active heading
  useEffect(() => {
    if (entries.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActiveId(e.target.id)
            break
          }
        }
      },
      { rootMargin: '-10% 0px -80% 0px', threshold: 0 }
    )
    entries.forEach(e => {
      const el = document.querySelector(`[data-block-id="${e.id}"]`)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [entries])

  if (entries.length < 2) return null

  function scrollTo(id: string) {
    const el = document.querySelector(`[data-block-id="${id}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="w-52 shrink-0 hidden xl:block">
      <div className="sticky top-8 py-8 pr-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
          <BookOpen className="w-3 h-3" />
          Contenido
        </div>
        <nav className="space-y-0.5">
          {entries.map(e => (
            <button
              key={e.id}
              onClick={() => scrollTo(e.id)}
              className={`block w-full text-left text-xs py-1 transition-colors leading-snug ${
                activeId === e.id ? 'text-[#17394f] font-medium' : 'text-slate-400 hover:text-slate-700'
              }`}
              style={{ paddingLeft: `${(e.level - 1) * 12}px` }}
            >
              {e.text}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
