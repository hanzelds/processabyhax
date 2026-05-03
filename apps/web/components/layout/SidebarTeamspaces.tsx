'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useSidebarStore } from '@/store/sidebarStore'
import { Teamspace, TeamspaceProject } from '@/types'
import { ChevronDown, ChevronRight, Lock, Eye, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Semaphore dot ─────────────────────────────────────────────────────────────

function dotColor(project: TeamspaceProject): string {
  if (!project.estimatedClose || project.status === 'COMPLETED') return '#d1d5db'
  const days = (new Date(project.estimatedClose).getTime() - Date.now()) / 86_400_000
  if (days < 0)  return '#ef4444'
  if (days <= 7) return '#f97316'
  return '#22c55e'
}

// ── Project row ───────────────────────────────────────────────────────────────

function ProjectRow({ project, isLast }: { project: TeamspaceProject; isLast: boolean }) {
  const pathname  = usePathname()
  const isActive  = pathname.startsWith(`/projects/${project.id}`)
  const color     = dotColor(project)

  return (
    <Link
      href={`/projects/${project.id}`}
      className={cn(
        'flex items-center gap-2 h-7 pl-8 pr-4 transition-colors duration-100',
        isActive ? 'text-[#17394f]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
      )}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs truncate flex-1">{project.name}</span>
    </Link>
  )
}

// ── Teamspace row ─────────────────────────────────────────────────────────────

function TeamspaceRow({ ts, collapsed }: { ts: Teamspace; collapsed: boolean }) {
  const { expandedTeamspaces, toggleTeamspace } = useSidebarStore()
  const pathname   = usePathname()
  const isExpanded = expandedTeamspaces.includes(ts.id)
  const canExpand  = ts.isMember || ts.isAdmin
  const isLocked   = !ts.isMember && ts.visibility === 'CLOSED'

  const visible = ts.projects.slice(0, 4)
  const extra   = ts.projects.length - visible.length

  return (
    <div>
      <button
        onClick={() => canExpand && toggleTeamspace(ts.id)}
        title={collapsed ? ts.name : undefined}
        className={cn(
          'flex items-center gap-3 w-full transition-all duration-150',
          collapsed ? 'mx-2 px-2 py-2.5 justify-center rounded-lg' : 'mx-2 px-3 py-2 rounded-lg',
          canExpand ? 'hover:bg-gray-50' : 'cursor-default opacity-60'
        )}
      >
        <span className="text-sm shrink-0 leading-none">{ts.emoji}</span>
        {!collapsed && (
          <>
            <span className={cn(
              'text-sm font-medium truncate flex-1 text-left',
              isExpanded ? 'text-gray-700' : 'text-gray-500'
            )}>
              {ts.name}
            </span>
            {isLocked && !ts.isAdmin && (
              <Lock className="w-3 h-3 text-gray-300 shrink-0" />
            )}
            {ts.isAdmin && !ts.isMember && (
              <Eye className="w-3 h-3 text-gray-300 shrink-0" />
            )}
            {canExpand && (
              isExpanded
                ? <ChevronDown  className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                : <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            )}
          </>
        )}
      </button>

      {!collapsed && isExpanded && canExpand && (
        <div>
          {visible.length === 0
            ? <p className="pl-11 h-7 flex items-center text-xs text-gray-300 italic">Sin proyectos activos</p>
            : visible.map((p, i) => (
                <ProjectRow key={p.id} project={p} isLast={i === visible.length - 1 && extra === 0} />
              ))
          }
          {extra > 0 && (
            <Link
              href={`/teamspaces/${ts.id}`}
              className="flex items-center h-6 pl-11 pr-4 text-[11px] text-[#17394f] hover:underline"
            >
              +{extra} más
            </Link>
          )}
          {/* Docs link */}
          <Link
            href={`/teamspaces/${ts.id}?tab=docs`}
            className={cn(
              'flex items-center gap-2 h-7 pl-8 pr-4 transition-colors duration-100',
              pathname.startsWith('/docs') ? 'text-[#17394f]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            )}
          >
            <BookOpen className="w-3 h-3 shrink-0" />
            <span className="text-xs truncate flex-1">Docs</span>
          </Link>
        </div>
      )}
    </div>
  )
}

// ── SidebarTeamspaces ─────────────────────────────────────────────────────────

export function SidebarTeamspaces({ collapsed, userRole }: { collapsed: boolean; userRole: string }) {
  const [teamspaces, setTeamspaces] = useState<Teamspace[]>([])

  useEffect(() => {
    fetch('/api/teamspaces', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(d => Array.isArray(d) && setTeamspaces(d))
      .catch(() => {})
  }, [])

  if (teamspaces.length === 0) return null

  return (
    <div className="mb-1">
      {!collapsed && (
        <p className="px-4 py-1.5 text-gray-400 text-[10px] font-semibold uppercase tracking-widest">
          Teamspaces
        </p>
      )}
      {collapsed && <div className="mx-3 my-1.5 h-px bg-gray-100" />}
      {teamspaces.map(ts => (
        <TeamspaceRow key={ts.id} ts={ts} collapsed={collapsed} />
      ))}
    </div>
  )
}
