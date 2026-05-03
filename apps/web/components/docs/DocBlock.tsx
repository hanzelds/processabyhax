'use client'

import { useState, useRef } from 'react'
import { DocBlock as DocBlockType, DocBlockType as BlockType } from '@/types'
import { TextBlock } from './blocks/TextBlock'
import { ListBlock } from './blocks/ListBlock'
import { CalloutBlock } from './blocks/CalloutBlock'
import { CodeBlock } from './blocks/CodeBlock'
import { ImageBlock } from './blocks/ImageBlock'
import { ChildPageBlock } from './blocks/ChildPageBlock'
import { BlockOptions } from './BlockOptions'
import { GripVertical, MoreHorizontal } from 'lucide-react'

interface Props {
  block: DocBlockType
  focused: boolean
  readOnly: boolean
  blockRef: (el: HTMLElement | null) => void
  onUpdate: (id: string, content: Partial<DocBlockType['content']>) => void
  onUpdateHtml: (id: string, html: string) => void
  onEnter: (id: string) => void
  onBackspaceEmpty: (id: string) => void
  onFocus: (id: string) => void
  onArrowUp: (id: string) => void
  onArrowDown: (id: string) => void
  onSlash: (id: string, position: { top: number; left: number }) => void
  onSlashClose: () => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onConvert: (id: string, type: BlockType) => void
}

export function DocBlockRenderer({
  block, focused, readOnly, blockRef,
  onUpdate, onUpdateHtml, onEnter, onBackspaceEmpty, onFocus,
  onArrowUp, onArrowDown, onSlash, onSlashClose,
  onMoveUp, onMoveDown, onDelete, onDuplicate, onConvert,
}: Props) {
  const [hovered, setHovered] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const optsBtnRef = useRef<HTMLButtonElement>(null)

  function getOptionsPosition() {
    const btn = optsBtnRef.current
    if (!btn) return { top: 0, left: 0 }
    const rect = btn.getBoundingClientRect()
    return { top: rect.bottom + 4, left: rect.left }
  }

  const isDivider = block.type === 'divider'

  return (
    <div
      className="group/block relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false) }}
    >
      {/* Sidebar controls */}
      {!readOnly && !isDivider && (
        <div className={`absolute -left-14 top-0.5 flex items-center gap-0.5 transition-opacity ${hovered || focused ? 'opacity-100' : 'opacity-0'}`}>
          <button className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing">
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <button
            ref={optsBtnRef}
            onClick={() => setShowOptions(s => !s)}
            className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-slate-500 rounded hover:bg-slate-100"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Block content */}
      {isDivider ? (
        <div ref={el => blockRef(el as HTMLElement)} className="py-3">
          <hr className="border-slate-200" />
        </div>
      ) : block.type === 'bulleted_list' || block.type === 'numbered_list' ? (
        <ListBlock
          block={block}
          readOnly={readOnly}
          blockRef={blockRef}
          onUpdate={items => onUpdate(block.id, { items })}
          onEnter={() => onEnter(block.id)}
          onBackspaceEmpty={() => onBackspaceEmpty(block.id)}
          onFocus={() => onFocus(block.id)}
        />
      ) : block.type === 'callout' ? (
        <CalloutBlock
          block={block}
          readOnly={readOnly}
          blockRef={blockRef}
          onUpdate={updates => onUpdate(block.id, updates)}
          onEnter={() => onEnter(block.id)}
          onBackspaceEmpty={() => onBackspaceEmpty(block.id)}
          onFocus={() => onFocus(block.id)}
        />
      ) : block.type === 'code' ? (
        <CodeBlock
          block={block}
          readOnly={readOnly}
          blockRef={blockRef}
          onUpdate={updates => onUpdate(block.id, updates)}
          onEnter={() => onEnter(block.id)}
          onFocus={() => onFocus(block.id)}
        />
      ) : block.type === 'image' ? (
        <ImageBlock
          block={block}
          readOnly={readOnly}
          blockRef={blockRef}
          onUpdate={updates => onUpdate(block.id, updates)}
          onFocus={() => onFocus(block.id)}
        />
      ) : block.type === 'child_page' ? (
        <ChildPageBlock
          block={block}
          blockRef={blockRef}
          onFocus={() => onFocus(block.id)}
        />
      ) : (
        // paragraph, heading_1/2/3
        <TextBlock
          block={block}
          focused={focused}
          readOnly={readOnly}
          blockRef={blockRef}
          onUpdate={html => onUpdateHtml(block.id, html)}
          onEnter={() => onEnter(block.id)}
          onBackspaceEmpty={() => onBackspaceEmpty(block.id)}
          onFocus={() => onFocus(block.id)}
          onArrowUp={() => onArrowUp(block.id)}
          onArrowDown={() => onArrowDown(block.id)}
          onSlash={pos => onSlash(block.id, pos)}
          onSlashClose={onSlashClose}
        />
      )}

      {/* Block options menu */}
      {showOptions && !readOnly && (
        <BlockOptions
          block={block}
          position={getOptionsPosition()}
          onMoveUp={() => onMoveUp(block.id)}
          onMoveDown={() => onMoveDown(block.id)}
          onDelete={() => onDelete(block.id)}
          onDuplicate={() => onDuplicate(block.id)}
          onConvert={type => onConvert(block.id, type)}
          onClose={() => setShowOptions(false)}
        />
      )}
    </div>
  )
}
