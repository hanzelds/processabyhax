import { DocBlock, DocBlockType } from '@/types'

export function makeBlock(type: DocBlockType = 'paragraph'): DocBlock {
  const id = Math.random().toString(36).slice(2, 10)
  const defaults: Record<DocBlockType, DocBlock['content']> = {
    paragraph:     { html: '' },
    heading_1:     { html: '' },
    heading_2:     { html: '' },
    heading_3:     { html: '' },
    bulleted_list: { items: [''] },
    numbered_list: { items: [''] },
    divider:       {},
    callout:       { icon: '💡', html: '' },
    code:          { language: 'javascript', text: '' },
    image:         { url: '', caption: '' },
    child_page:    { pageId: '', title: 'Sin título', pageIcon: '📄' },
  }
  return { id, type, content: defaults[type] }
}

export function placeCursorAtEnd(el: HTMLElement) {
  if (!el) return
  el.focus()
  const range = document.createRange()
  const sel = window.getSelection()
  range.selectNodeContents(el)
  range.collapse(false)
  sel?.removeAllRanges()
  sel?.addRange(range)
}

export function placeCursorAtStart(el: HTMLElement) {
  if (!el) return
  el.focus()
  const range = document.createRange()
  const sel = window.getSelection()
  range.selectNodeContents(el)
  range.collapse(true)
  sel?.removeAllRanges()
  sel?.addRange(range)
}

export function isBlockEmpty(block: DocBlock): boolean {
  if (block.type === 'divider') return false
  if (block.type === 'image') return !block.content.url
  if (block.type === 'code') return !block.content.text?.trim()
  if (block.type === 'bulleted_list' || block.type === 'numbered_list') {
    return (block.content.items ?? []).every(i => !i.trim())
  }
  const text = block.content.html?.replace(/<[^>]*>/g, '') ?? ''
  return !text.trim()
}

export const BLOCK_LABELS: Record<DocBlockType, { label: string; description: string; icon: string; shortcut: string }> = {
  paragraph:     { label: 'Texto',        description: 'Párrafo de texto normal',        icon: '¶',  shortcut: '' },
  heading_1:     { label: 'Título 1',     description: 'Sección principal grande',       icon: 'H1', shortcut: '/tit' },
  heading_2:     { label: 'Título 2',     description: 'Sección secundaria',             icon: 'H2', shortcut: '/tit2' },
  heading_3:     { label: 'Título 3',     description: 'Sección terciaria pequeña',      icon: 'H3', shortcut: '/tit3' },
  bulleted_list: { label: 'Lista',        description: 'Lista con viñetas',              icon: '•',  shortcut: '/lis' },
  numbered_list: { label: 'Lista numerada', description: 'Lista con numeración',         icon: '1.', shortcut: '/num' },
  divider:       { label: 'Divisor',      description: 'Línea separadora',               icon: '—',  shortcut: '/div' },
  callout:       { label: 'Callout',      description: 'Bloque destacado con ícono',     icon: '💡', shortcut: '/cal' },
  code:          { label: 'Código',       description: 'Bloque de código con sintaxis',  icon: '<>', shortcut: '/cod' },
  image:         { label: 'Imagen',       description: 'Imagen con caption',             icon: '🖼', shortcut: '/ima' },
  child_page:    { label: 'Sub-página',   description: 'Enlace a una página anidada',   icon: '📄', shortcut: '/pag' },
}
