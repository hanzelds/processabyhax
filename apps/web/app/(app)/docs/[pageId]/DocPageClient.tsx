'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DocPage, DocPageSummary } from '@/types'
import { DocEditor } from '@/components/docs/DocEditor'
import { DocSidebar } from '@/components/docs/DocSidebar'
import { ChevronRight } from 'lucide-react'

interface Props {
  page: DocPage
  tree: DocPageSummary[]
  contextName: string
  contextEmoji?: string
  isAdmin: boolean
}

export function DocPageClient({ page, tree, contextName, contextEmoji, isAdmin }: Props) {
  const [pageTitle, setPageTitle] = useState(page.title)

  // Build breadcrumb from tree
  function findAncestors(pages: DocPageSummary[], targetId: string, path: DocPageSummary[] = []): DocPageSummary[] | null {
    for (const p of pages) {
      if (p.id === targetId) return [...path, p]
      if (p.children.length) {
        const found = findAncestors(p.children, targetId, [...path, p])
        if (found) return found
      }
    }
    return null
  }

  const ancestors = findAncestors(tree, page.id) ?? []

  const backHref = page.contextType === 'client'
    ? `/clients/${page.contextId}?tab=docs`
    : (page.contextType === 'workspace' ? '/docs' : `/teamspaces/${page.contextId}`)

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Left sidebar — doc tree */}
      <DocSidebar
        contextType={page.contextType}
        contextId={page.contextId}
        contextName={contextName}
        contextEmoji={contextEmoji}
        currentPageId={page.id}
        initialPages={tree}
        isAdmin={isAdmin}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Breadcrumb bar */}
        <div className="flex items-center gap-1 px-6 py-2.5 border-b border-slate-100 text-xs text-slate-400 bg-white shrink-0">
          <Link href={backHref} className="hover:text-slate-600 transition-colors truncate max-w-[120px]">
            {contextEmoji} {contextName}
          </Link>
          {ancestors.slice(0, -1).map(a => (
            <span key={a.id} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3" />
              <Link href={`/docs/${a.id}`} className="hover:text-slate-600 transition-colors truncate max-w-[120px]">
                {a.icon ?? '📄'} {a.title || 'Sin título'}
              </Link>
            </span>
          ))}
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-700 font-medium truncate max-w-[200px]">
            {page.icon ?? '📄'} {pageTitle || 'Sin título'}
          </span>
        </div>

        {/* Editor */}
        <DocEditor
          page={page}
          readOnly={false}
          onTitleChange={setPageTitle}
        />
      </div>
    </div>
  )
}
