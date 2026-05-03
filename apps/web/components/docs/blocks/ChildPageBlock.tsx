'use client'

import Link from 'next/link'
import { DocBlock } from '@/types'
import { FileText } from 'lucide-react'

interface Props {
  block: DocBlock
  blockRef: (el: HTMLElement | null) => void
  onFocus: () => void
}

export function ChildPageBlock({ block, blockRef, onFocus }: Props) {
  const { pageId, title, pageIcon } = block.content

  if (!pageId) {
    return (
      <div ref={el => blockRef(el as HTMLElement)} className="flex items-center gap-2 text-slate-400 text-sm py-1" onFocus={onFocus}>
        <FileText className="w-4 h-4" />
        <span className="italic">Sub-página no configurada</span>
      </div>
    )
  }

  return (
    <div ref={el => blockRef(el as HTMLElement)} onFocus={onFocus}>
      <Link
        href={`/docs/${pageId}`}
        className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors group"
      >
        <span className="text-lg">{pageIcon ?? '📄'}</span>
        <span className="text-[15px] font-medium text-slate-800 group-hover:text-[#17394f] transition-colors">
          {title || 'Sin título'}
        </span>
      </Link>
    </div>
  )
}
