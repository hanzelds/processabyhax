'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Project, User, ProjectMember, ProjectFile, ProjectHistoryEntry, ProjectMetrics, DeadlineStatus } from '@/types'
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_COLOR, formatDate } from '@/lib/utils'
import { ProjectTabs, TabId } from './ProjectTabs'
import { ProjectInfoBlock } from './summary/ProjectInfoBlock'
import { ProjectMetricsBlock } from './summary/ProjectMetricsBlock'
import { ProjectMembersBlock } from './members/ProjectMembersBlock'
import { ProjectFilesTab } from './files/ProjectFilesTab'
import { ProjectHistoryTab } from './history/ProjectHistoryTab'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'

const DEADLINE_BADGE: Record<DeadlineStatus, { label: string; cls: string }> = {
  on_track: { label: '🟢 En tiempo',  cls: 'text-emerald-600' },
  urgent:   { label: '🟡 Próximo',    cls: 'text-amber-600'   },
  overdue:  { label: '🔴 Vencido',    cls: 'text-red-600'     },
  no_date:  { label: '',              cls: ''                  },
}

interface HistoryData { entries: ProjectHistoryEntry[]; total: number; hasMore: boolean }

interface Props {
  project: Project
  metrics: ProjectMetrics
  members: ProjectMember[]
  files: ProjectFile[]
  historyData: HistoryData
  users: User[]
  currentUserId: string
  isAdmin: boolean
}

export function ProjectDetailClient({ project: initialProject, metrics, members, files, historyData, users, currentUserId, isAdmin }: Props) {
  const [project, setProject] = useState(initialProject)
  const [activeTab, setActiveTab] = useState<TabId>('summary')
  const [fileCount, setFileCount] = useState(files.length)

  const dl = DEADLINE_BADGE[project.deadlineStatus ?? 'no_date']

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
        <Link href="/projects" className="hover:text-slate-600 transition-colors">Proyectos</Link>
        <span>/</span>
        {project.client && (
          <>
            <Link href={`/clients/${project.client.id}`} className="hover:text-slate-600 transition-colors">{project.client.name}</Link>
            <span>/</span>
          </>
        )}
        <span className="text-slate-700 font-medium truncate">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PROJECT_STATUS_COLOR[project.status]}`}>
              {PROJECT_STATUS_LABEL[project.status]}
            </span>
            {dl.label && <span className={`text-sm font-medium ${dl.cls}`}>{dl.label}</span>}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>Inicio: {formatDate(project.startDate)}</span>
            {project.estimatedClose && <span>Cierre: {formatDate(project.estimatedClose)}</span>}
            {project.daysRemaining !== undefined && project.daysRemaining !== null && project.deadlineStatus !== 'on_track' && (
              <span className={project.daysRemaining < 0 ? 'text-red-500 font-medium' : 'text-amber-500 font-medium'}>
                {project.daysRemaining < 0 ? `${Math.abs(project.daysRemaining)}d vencido` : `${project.daysRemaining}d restantes`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ProjectTabs activeTab={activeTab} onChange={setActiveTab} filesCount={fileCount} />

      {/* Tab content */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <ProjectInfoBlock project={project} isAdmin={isAdmin} onUpdate={p => setProject(p)} />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <ProjectMetricsBlock metrics={metrics} />
            <ProjectMembersBlock
              projectId={project.id}
              initialMembers={members}
              users={users}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      )}

      {activeTab === 'kanban' && (
        <KanbanBoard
          initialTasks={project.tasks || []}
          projectId={project.id}
          isAdmin={isAdmin}
          users={users}
        />
      )}

      {activeTab === 'files' && (
        <ProjectFilesTab
          projectId={project.id}
          initialFiles={files}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          isCompleted={project.status === 'COMPLETED'}
        />
      )}

      {activeTab === 'history' && (
        <ProjectHistoryTab projectId={project.id} initialData={historyData} />
      )}
    </div>
  )
}
