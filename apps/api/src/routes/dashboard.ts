import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdmin } from '../middleware/auth'
import { relativeTime } from '../lib/activityLogger'

export const dashboardRouter = Router()

// ─── ADMIN ENDPOINTS ────────────────────────────────────────────────────────

dashboardRouter.get('/admin/kpis', isAdmin, async (_req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const [activeProjects, tasksInProgress, tasksOverdue, tasksBlocked] = await Promise.all([
    prisma.project.count({ where: { status: { in: ['ACTIVE', 'IN_PROGRESS'] } } }),
    prisma.task.count({ where: { status: 'IN_PROGRESS', project: { status: { in: ['ACTIVE', 'IN_PROGRESS'] } } } }),
    prisma.task.count({ where: { status: { notIn: ['COMPLETED'] }, dueDate: { lt: today } } }),
    prisma.task.count({ where: { status: 'BLOCKED' } }),
  ])

  res.json({ activeProjects, tasksInProgress, tasksOverdue, tasksBlocked })
})

dashboardRouter.get('/admin/workload', isAdmin, async (req, res) => {
  const { area } = req.query
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const users = await prisma.user.findMany({
    where: { role: 'TEAM', ...(area ? { area: area as string } : {}) },
    select: { id: true, name: true, area: true },
    orderBy: { name: 'asc' },
  })

  // Total tareas activas en el sistema para calcular carga relativa
  const totalActive = await prisma.task.count({ where: { status: { notIn: ['COMPLETED'] } } })

  const workload = await Promise.all(users.map(async (u) => {
    const [totalAssigned, inProgress, overdue, blocked] = await Promise.all([
      prisma.task.count({ where: { assignees: { some: { userId: u.id } }, status: { notIn: ['COMPLETED'] } } }),
      prisma.task.count({ where: { assignees: { some: { userId: u.id } }, status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { assignees: { some: { userId: u.id } }, status: { notIn: ['COMPLETED'] }, dueDate: { lt: today } } }),
      prisma.task.count({ where: { assignees: { some: { userId: u.id } }, status: 'BLOCKED' } }),
    ])
    const loadPct = totalActive > 0 ? Math.round((totalAssigned / totalActive) * 100) : 0
    return { userId: u.id, name: u.name, area: u.area, totalActive: totalAssigned, inProgress, overdue, blocked, loadPct }
  }))

  // Ordenar por más cargado por defecto
  const sort = req.query.sort as string
  if (sort === 'available') workload.sort((a, b) => a.totalActive - b.totalActive)
  else if (sort === 'alpha') workload.sort((a, b) => a.name.localeCompare(b.name))
  else workload.sort((a, b) => b.totalActive - a.totalActive)

  res.json(workload)
})

dashboardRouter.get('/admin/projects-progress', isAdmin, async (req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const projects = await prisma.project.findMany({
    where: { status: { in: ['ACTIVE', 'IN_PROGRESS'] } },
    include: {
      client: { select: { name: true } },
      tasks: { select: { status: true } },
    },
    orderBy: { estimatedClose: 'asc' },
  })

  const sort = req.query.sort as string

  const result = projects.map(p => {
    const total = p.tasks.length
    const completed = p.tasks.filter(t => t.status === 'COMPLETED').length
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0
    const daysRemaining = p.estimatedClose
      ? Math.ceil((p.estimatedClose.getTime() - today.getTime()) / 86400000)
      : null
    const isOverdue = daysRemaining !== null && daysRemaining < 0
    const isUrgent = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7

    return {
      projectId: p.id,
      projectName: p.name,
      clientName: p.client.name,
      status: p.status,
      tasksTotal: total,
      tasksCompleted: completed,
      progressPct,
      estimatedClose: p.estimatedClose,
      daysRemaining,
      isOverdue,
      isUrgent,
      noTasks: total === 0,
      suggestClose: progressPct === 100 && p.status !== 'COMPLETED',
    }
  })

  if (sort === 'progress_asc') result.sort((a, b) => a.progressPct - b.progressPct)
  else if (sort === 'progress_desc') result.sort((a, b) => b.progressPct - a.progressPct)
  // default: por fecha estimada de cierre (más próximo primero)

  res.json(result)
})

dashboardRouter.get('/admin/activity', isAdmin, async (req, res) => {
  const { limit = '20', offset = '0', event_type, user_id, from, to } = req.query

  const where: Record<string, unknown> = {}
  if (event_type) where.eventType = event_type
  if (user_id) where.actorId = user_id
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from as string) } : {}),
      ...(to ? { lte: new Date(to as string) } : {}),
    }
  }

  const [entries, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    }),
    prisma.activityLog.count({ where }),
  ])

  const result = entries.map(e => ({
    id: e.id,
    actorName: e.actor.name,
    eventType: e.eventType,
    entityType: e.entityType,
    entityName: e.entityName,
    meta: e.meta,
    createdAt: e.createdAt,
    relativeTime: relativeTime(e.createdAt),
  }))

  res.json({ entries: result, total, hasMore: Number(offset) + Number(limit) < total })
})

// ─── SHARED HELPERS ──────────────────────────────────────────────────────────

/** Consecutive days (going back from today) where userId completed ≥ 1 task */
async function getStreak(userId: string): Promise<number> {
  const cutoff = new Date(Date.now() - 31 * 86400000)
  const completions = await prisma.task.findMany({
    where: { assignees: { some: { userId } }, status: 'COMPLETED', completedAt: { gte: cutoff, not: null } },
    select: { completedAt: true },
  })
  if (!completions.length) return 0

  const activeDays = new Set(
    completions.map(t => t.completedAt!.toISOString().split('T')[0])
  )

  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  while (true) {
    const dayStr = cursor.toISOString().split('T')[0]
    if (activeDays.has(dayStr)) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

// ─── TEAM ENDPOINTS ──────────────────────────────────────────────────────────

dashboardRouter.get('/team/kpis', isAuth, async (req, res) => {
  const { userId } = req.user!
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const endOfWeek = new Date(today); endOfWeek.setDate(today.getDate() + (7 - today.getDay() || 7))
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)

  const [todayCount, inProgress, overdue, blocked, completedWeek, completedMonth, dueThisWeek, activeProjectsRaw, streak, recentCompleted] = await Promise.all([
    prisma.task.count({ where: { assignees: { some: { userId } }, status: { notIn: ['COMPLETED'] }, dueDate: { gte: today, lt: tomorrow } } }),
    prisma.task.count({ where: { assignees: { some: { userId } }, status: 'IN_PROGRESS' } }),
    prisma.task.count({ where: { assignees: { some: { userId } }, status: { notIn: ['COMPLETED'] }, dueDate: { lt: today } } }),
    prisma.task.count({ where: { assignees: { some: { userId } }, status: 'BLOCKED' } }),
    prisma.task.count({ where: { assignees: { some: { userId } }, status: 'COMPLETED', completedAt: { gte: weekAgo } } }),
    prisma.task.count({ where: { assignees: { some: { userId } }, status: 'COMPLETED', completedAt: { gte: monthStart } } }),
    prisma.task.count({ where: { assignees: { some: { userId } }, status: { notIn: ['COMPLETED'] }, dueDate: { gte: today, lte: endOfWeek } } }),
    prisma.task.findMany({ where: { assignees: { some: { userId } }, status: { notIn: ['COMPLETED'] } }, select: { projectId: true }, distinct: ['projectId'] }),
    getStreak(userId),
    // For completion rate: tasks completed in last 30 days WITH a dueDate
    prisma.task.findMany({
      where: { assignees: { some: { userId } }, status: 'COMPLETED', completedAt: { gte: thirtyDaysAgo }, dueDate: { not: null } },
      select: { completedAt: true, dueDate: true },
    }),
  ])

  // Completion rate: % completed on or before their dueDate
  const onTime = recentCompleted.filter(t => t.completedAt! <= new Date(t.dueDate!.getTime() + 86400000)) // +1 day grace
  const completionRatePct = recentCompleted.length > 0
    ? Math.round((onTime.length / recentCompleted.length) * 100)
    : 100

  res.json({
    // Estado
    todayCount, inProgress, overdue, blocked,
    // Rendimiento
    completedWeek, completedMonth, completionRatePct, streakDays: streak,
    // Carga
    dueThisWeek, activeProjects: activeProjectsRaw.length,
  })
})

dashboardRouter.get('/team/projects-progress', isAuth, async (req, res) => {
  const { userId } = req.user!
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const projects = await prisma.project.findMany({
    where: {
      status: { in: ['ACTIVE', 'IN_PROGRESS'] },
      tasks: { some: { assignees: { some: { userId } } } },
    },
    include: {
      client: { select: { name: true } },
      tasks: { select: { status: true } },
    },
    orderBy: { estimatedClose: 'asc' },
  })

  const result = projects.map(p => {
    const total = p.tasks.length
    const completed = p.tasks.filter(t => t.status === 'COMPLETED').length
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0
    const daysRemaining = p.estimatedClose
      ? Math.ceil((p.estimatedClose.getTime() - today.getTime()) / 86400000)
      : null
    return {
      projectId: p.id, projectName: p.name, clientName: p.client.name,
      status: p.status, tasksTotal: total, tasksCompleted: completed, progressPct,
      estimatedClose: p.estimatedClose, daysRemaining,
      isOverdue: daysRemaining !== null && daysRemaining < 0,
      isUrgent: daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7,
    }
  })

  res.json(result)
})

// ─── LEAD ENDPOINTS ──────────────────────────────────────────────────────────

dashboardRouter.get('/lead/kpis', isAuth, async (req, res) => {
  const { userId, role } = req.user!
  if (role !== 'LEAD' && role !== 'ADMIN') {
    res.status(403).json({ error: 'Sin permiso' }); return
  }

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const in7days = new Date(today); in7days.setDate(today.getDate() + 7)
  const ninety = new Date(today); ninety.setDate(today.getDate() - 90)

  // Proyectos donde este usuario tiene rol 'lead'
  const leadMemberships = await prisma.projectMember.findMany({
    where: { userId, roleInProject: 'lead' },
    select: { projectId: true },
  })
  const projectIds = leadMemberships.map(m => m.projectId)

  // Miembros del equipo (otros usuarios en esos proyectos)
  const teamMemberRows = await prisma.projectMember.findMany({
    where: { projectId: { in: projectIds }, userId: { not: userId } },
    select: { userId: true },
    distinct: ['userId'],
  })
  const memberIds = teamMemberRows.map(m => m.userId)

  // Proyectos activos con sus tareas
  const activeProjectsData = await prisma.project.findMany({
    where: { id: { in: projectIds }, status: { in: ['ACTIVE', 'IN_PROGRESS'] } },
    include: {
      client: { select: { name: true } },
      tasks:  { select: { status: true } },
    },
  })

  const projectsWithProgress = activeProjectsData.map(p => {
    const total = p.tasks.length
    const completed = p.tasks.filter(t => t.status === 'COMPLETED').length
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0
    const daysLeft = p.estimatedClose
      ? Math.ceil((p.estimatedClose.getTime() - today.getTime()) / 86400000)
      : null
    return { id: p.id, name: p.name, clientName: p.client.name, progressPct: pct, daysLeft }
  })

  const activeCount   = projectsWithProgress.length
  const overdueProj   = projectsWithProgress.filter(p => p.daysLeft !== null && p.daysLeft < 0).length
  const atRiskProj    = projectsWithProgress.filter(p => p.daysLeft !== null && p.daysLeft >= 0 && p.daysLeft <= 7 && p.progressPct < 80).length
  const avgProgress   = activeCount > 0
    ? Math.round(projectsWithProgress.reduce((s, p) => s + p.progressPct, 0) / activeCount)
    : 0

  // Tasa de entrega a tiempo (proyectos completados últimos 90 días)
  const recentCompletedProj = await prisma.project.findMany({
    where: { id: { in: projectIds }, status: 'COMPLETED', closedAt: { gte: ninety } },
    select: { closedAt: true, estimatedClose: true },
  })
  const onTimeProjects = recentCompletedProj.filter(p => p.closedAt && p.estimatedClose && p.closedAt <= p.estimatedClose)
  const deliveryRatePct = recentCompletedProj.length > 0
    ? Math.round((onTimeProjects.length / recentCompletedProj.length) * 100)
    : 100

  // KPIs de equipo
  const [overdueTeamTasks, blockedTeamTasks, membersWithLoad] = await Promise.all([
    prisma.task.count({ where: { projectId: { in: projectIds }, status: { notIn: ['COMPLETED'] }, dueDate: { lt: today } } }),
    prisma.task.count({ where: { projectId: { in: projectIds }, status: 'BLOCKED' } }),
    Promise.all(memberIds.map(async uid => {
      const [active, overdue] = await Promise.all([
        prisma.task.count({ where: { assignees: { some: { userId: uid } }, projectId: { in: projectIds }, status: { notIn: ['COMPLETED'] } } }),
        prisma.task.count({ where: { assignees: { some: { userId: uid } }, projectId: { in: projectIds }, status: { notIn: ['COMPLETED'] }, dueDate: { lt: today } } }),
      ])
      return { userId: uid, active, overdue }
    })),
  ])

  const availableMembers = membersWithLoad.filter(m => m.active === 0).length
  const sortedByLoad = [...membersWithLoad].sort((a, b) => b.active - a.active)
  const mostLoaded = sortedByLoad[0] ?? null
  const overdueMembers = membersWithLoad.filter(m => m.overdue > 0)

  // Enriquecer con nombres
  const [mostLoadedInfo, overdueNames] = await Promise.all([
    mostLoaded && mostLoaded.active > 0
      ? prisma.user.findUnique({ where: { id: mostLoaded.userId }, select: { id: true, name: true, area: true } })
          .then(u => u ? { id: u.id, name: u.name, area: u.area, load: mostLoaded.active } : null)
      : Promise.resolve(null),
    overdueMembers.length > 0
      ? prisma.user.findMany({ where: { id: { in: overdueMembers.map(m => m.userId) } }, select: { id: true, name: true } })
          .then(users => users.map(u => ({ ...u, overdueCount: overdueMembers.find(m => m.userId === u.id)!.overdue })))
      : Promise.resolve([]),
  ])

  res.json({
    projects: {
      active:          activeCount,
      atRisk:          atRiskProj,
      overdue:         overdueProj,
      avgProgressPct:  avgProgress,
      deliveryRatePct,
    },
    team: {
      totalMembers:      memberIds.length,
      availableMembers,
      overdueTasksCount: overdueTeamTasks,
      blockedTasksCount: blockedTeamTasks,
      mostLoadedMember:  mostLoadedInfo,
      overdueMembers,
    },
  })
})
