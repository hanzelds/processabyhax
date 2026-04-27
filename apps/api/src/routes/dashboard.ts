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
      prisma.task.count({ where: { assignedTo: u.id, status: { notIn: ['COMPLETED'] } } }),
      prisma.task.count({ where: { assignedTo: u.id, status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { assignedTo: u.id, status: { notIn: ['COMPLETED'] }, dueDate: { lt: today } } }),
      prisma.task.count({ where: { assignedTo: u.id, status: 'BLOCKED' } }),
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

// ─── TEAM ENDPOINTS ──────────────────────────────────────────────────────────

dashboardRouter.get('/team/kpis', isAuth, async (req, res) => {
  const { userId } = req.user!
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)

  const [todayCount, inProgress, overdue, completedWeek] = await Promise.all([
    prisma.task.count({ where: { assignedTo: userId, status: { notIn: ['COMPLETED'] }, dueDate: { gte: today, lt: tomorrow } } }),
    prisma.task.count({ where: { assignedTo: userId, status: 'IN_PROGRESS' } }),
    prisma.task.count({ where: { assignedTo: userId, status: { notIn: ['COMPLETED'] }, dueDate: { lt: today } } }),
    prisma.task.count({ where: { assignedTo: userId, status: 'COMPLETED', updatedAt: { gte: weekAgo } } }),
  ])

  res.json({ todayCount, inProgress, overdue, completedWeek })
})

dashboardRouter.get('/team/projects-progress', isAuth, async (req, res) => {
  const { userId } = req.user!
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const projects = await prisma.project.findMany({
    where: {
      status: { in: ['ACTIVE', 'IN_PROGRESS'] },
      tasks: { some: { assignedTo: userId } },
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
