import { AdminKPIs, WorkloadEntry, ProjectProgress, ActivityFeedResponse } from '@/types/dashboard'
import { AdminKPIBar } from './kpis/AdminKPIBar'
import { WorkloadWidget } from './workload/WorkloadWidget'
import { ProjectsProgressWidget } from './progress/ProjectsProgressWidget'
import { ActivityFeed } from './activity/ActivityFeed'
import { TaskCard } from '@/components/ui/TaskCard'
import { Task, AdminTaskAlerts } from '@/types'
import Link from 'next/link'

interface Props {
  kpis: AdminKPIs
  workload: WorkloadEntry[]
  progress: ProjectProgress[]
  activity: ActivityFeedResponse
  myTasks: { today: Task[]; pending: Task[]; overdue: Task[] }
  adminAlerts: AdminTaskAlerts
}

export function AdminDashboard({ kpis, workload, progress, activity, myTasks, adminAlerts }: Props) {
  const myTotal = myTasks.today.length + myTasks.pending.length + myTasks.overdue.length
  const hasAdminAlerts = adminAlerts.overdue > 0 || adminAlerts.dueSoon > 0 || adminAlerts.blocked > 0

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Panel de operaciones</h1>
        <p className="text-slate-500 text-sm mt-1">Vista global del equipo y proyectos activos</p>
      </div>

      {/* Admin Task Alerts */}
      {hasAdminAlerts && (
        <div className="flex flex-wrap gap-2 mb-5">
          {adminAlerts.overdue > 0 && (
            <Link href="/admin/tasks?tab=all" className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-medium px-3 py-1.5 rounded-full hover:bg-red-100 transition-colors">
              ⚠ Admin: {adminAlerts.overdue} vencida{adminAlerts.overdue !== 1 ? 's' : ''}
            </Link>
          )}
          {adminAlerts.dueSoon > 0 && (
            <Link href="/admin/tasks?tab=all" className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-medium px-3 py-1.5 rounded-full hover:bg-orange-100 transition-colors">
              ⏰ Admin: {adminAlerts.dueSoon} por vencer
            </Link>
          )}
          {adminAlerts.blocked > 0 && (
            <Link href="/admin/tasks?tab=pending" className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-medium px-3 py-1.5 rounded-full hover:bg-yellow-100 transition-colors">
              ⊘ Admin: {adminAlerts.blocked} bloqueada{adminAlerts.blocked !== 1 ? 's' : ''}
            </Link>
          )}
        </div>
      )}

      {/* KPI Bar */}
      <AdminKPIBar kpis={kpis} />

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Columna izquierda: Workload + Activity */}
        <div className="lg:col-span-2 space-y-6">
          <WorkloadWidget data={workload} />
          <ActivityFeed initialData={activity} />
        </div>

        {/* Columna derecha: Progress + Mis tareas */}
        <div className="space-y-6">
          <ProjectsProgressWidget data={progress} />

          {myTotal > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 mb-4">Mis tareas</h2>
              {myTasks.overdue.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-red-500 font-semibold uppercase tracking-wider mb-2">Atrasadas</p>
                  <div className="space-y-2">{myTasks.overdue.map(t => <TaskCard key={t.id} task={t} overdue />)}</div>
                </div>
              )}
              {myTasks.today.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-amber-500 font-semibold uppercase tracking-wider mb-2">Hoy</p>
                  <div className="space-y-2">{myTasks.today.map(t => <TaskCard key={t.id} task={t} />)}</div>
                </div>
              )}
              {myTasks.pending.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Pendientes</p>
                  <div className="space-y-2">{myTasks.pending.slice(0, 5).map(t => <TaskCard key={t.id} task={t} />)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
