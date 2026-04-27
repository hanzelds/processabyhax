import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdmin } from '../middleware/auth'
import { ProjectStatus } from '@prisma/client'
import { logActivity } from '../lib/activityLogger'
import { logProjectHistory, relativeTime } from '../lib/projectHistory'
import { logClientHistory } from '../lib/clientHistory'

export const projectsRouter = Router()

// ── helpers ─────────────────────────────────────────────────────────────────

function deadlineStatus(estimatedClose: Date | null, status: string): 'on_track' | 'urgent' | 'overdue' | 'no_date' {
  if (!estimatedClose) return 'no_date'
  if (status === 'COMPLETED') return 'on_track'
  const now = new Date()
  const days = Math.ceil((estimatedClose.getTime() - now.getTime()) / 86400000)
  if (days < 0) return 'overdue'
  if (days <= 14) return 'urgent'
  return 'on_track'
}

function daysRemaining(estimatedClose: Date | null): number | null {
  if (!estimatedClose) return null
  return Math.ceil((estimatedClose.getTime() - Date.now()) / 86400000)
}

async function ensureMember(projectId: string, userId: string, addedById: string) {
  const exists = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } })
  if (!exists) {
    await prisma.projectMember.create({ data: { projectId, userId, addedById } })
    const [user, project] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
    ])
    await logProjectHistory({
      projectId, actorId: addedById,
      eventType: 'member_added',
      description: `${user?.name} fue agregado al proyecto automáticamente al asignarle una tarea`,
      meta: { userId, role_in_project: 'executor' },
    })
  }
}

// ── GET /projects (list with inline metrics) ─────────────────────────────────

projectsRouter.get('/', isAuth, async (req, res) => {
  const { user } = req
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const where = (user!.role === 'ADMIN' || user!.role === 'LEAD')
    ? {}
    : { tasks: { some: { assignedTo: user!.userId } } }

  const projects = await prisma.project.findMany({
    where,
    orderBy: { estimatedClose: 'asc' },
    include: {
      client: { select: { id: true, name: true, status: true } },
      members: { include: { user: { select: { id: true, name: true, area: true } } } },
      _count: { select: { tasks: true } },
    },
  })

  // Compute metrics per project
  const result = await Promise.all(projects.map(async p => {
    const [total, completed, overdue, blocked] = await Promise.all([
      prisma.task.count({ where: { projectId: p.id } }),
      prisma.task.count({ where: { projectId: p.id, status: 'COMPLETED' } }),
      prisma.task.count({ where: { projectId: p.id, status: { not: 'COMPLETED' }, dueDate: { lt: today } } }),
      prisma.task.count({ where: { projectId: p.id, status: 'BLOCKED' } }),
    ])
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0

    return {
      ...p,
      tasksTotal: total,
      tasksCompleted: completed,
      tasksOverdue: overdue,
      tasksBlocked: blocked,
      progressPct,
      daysRemaining: daysRemaining(p.estimatedClose),
      deadlineStatus: deadlineStatus(p.estimatedClose, p.status),
      members: p.members.map(m => m.user),
    }
  }))

  res.json(result)
})

// ── GET /projects/:id ────────────────────────────────────────────────────────

projectsRouter.get('/:id', isAuth, async (req, res) => {
  const { user } = req
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      client: true,
      tasks: {
        where: user!.role === 'TEAM' ? { assignedTo: user!.userId } : {},
        orderBy: { createdAt: 'asc' },
        include: { assignee: { select: { id: true, name: true, area: true } } },
      },
      members: {
        include: { user: { select: { id: true, name: true, area: true } } },
        orderBy: { addedAt: 'asc' },
      },
    },
  })
  if (!project) { res.status(404).json({ error: 'Proyecto no encontrado' }); return }
  res.json(project)
})

// ── GET /projects/:id/metrics ────────────────────────────────────────────────

projectsRouter.get('/:id/metrics', isAuth, async (req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const [tasksByStatus, unassigned, overdue, activeMembers] = await Promise.all([
    prisma.task.groupBy({ by: ['status'], where: { projectId: req.params.id }, _count: { id: true } }),
    prisma.task.count({ where: { projectId: req.params.id, assignedTo: null } }),
    prisma.task.count({ where: { projectId: req.params.id, status: { not: 'COMPLETED' }, dueDate: { lt: today } } }),
    prisma.task.findMany({
      where: { projectId: req.params.id, status: { not: 'COMPLETED' }, assignedTo: { not: null } },
      distinct: ['assignedTo'],
      select: { assignedTo: true },
    }),
  ])

  const total = tasksByStatus.reduce((s, r) => s + r._count.id, 0)
  const completed = tasksByStatus.find(r => r.status === 'COMPLETED')?._count.id ?? 0
  const byStatus: Record<string, number> = {}
  tasksByStatus.forEach(r => { byStatus[r.status] = r._count.id })

  res.json({
    progressPct: total > 0 ? Math.round((completed / total) * 100) : 0,
    tasksByStatus: byStatus,
    tasksTotal: total,
    tasksCompleted: completed,
    tasksUnassigned: unassigned,
    tasksOverdue: overdue,
    activeMembers: activeMembers.length,
  })
})

// ── POST /projects ───────────────────────────────────────────────────────────

projectsRouter.post('/', isAdmin, async (req, res) => {
  const { name, clientId, description, startDate, estimatedClose } = req.body
  if (!name || !clientId || !startDate) {
    res.status(400).json({ error: 'Nombre, cliente y fecha de inicio son requeridos' }); return
  }
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } })
  const project = await prisma.project.create({
    data: { name, clientId, description, startDate: new Date(startDate), estimatedClose: estimatedClose ? new Date(estimatedClose) : undefined },
    include: { client: { select: { id: true, name: true } } },
  })
  await Promise.all([
    logActivity({ actorId: req.user!.userId, eventType: 'project_created', entityType: 'project', entityId: project.id, entityName: project.name, meta: { client_name: client?.name } }),
    logProjectHistory({ projectId: project.id, actorId: req.user!.userId, eventType: 'project_created', description: `Proyecto creado por ${req.user!.name ?? 'Admin'}`, meta: { client_name: client?.name } }),
    logClientHistory({ clientId, actorId: req.user!.userId, eventType: 'project_created', description: `Proyecto "${project.name}" creado`, meta: { projectId: project.id } }),
  ])
  res.status(201).json(project)
})

// ── PATCH /projects/:id ──────────────────────────────────────────────────────

projectsRouter.patch('/:id', isAdmin, async (req, res) => {
  const { name, description, status, estimatedClose } = req.body
  const prev = await prisma.project.findUnique({ where: { id: req.params.id } })
  if (!prev) { res.status(404).json({ error: 'Proyecto no encontrado' }); return }
  if (prev.status === 'COMPLETED') { res.status(400).json({ error: 'Proyecto completado: solo lectura' }); return }

  const data: Record<string, unknown> = {}
  if (name) data.name = name
  if (description !== undefined) data.description = description
  if (status) {
    data.status = status as ProjectStatus
    if (status === 'COMPLETED') data.closedAt = new Date()
  }
  if (estimatedClose !== undefined) data.estimatedClose = estimatedClose ? new Date(estimatedClose) : null

  const project = await prisma.project.update({ where: { id: req.params.id }, data, include: { client: { select: { id: true, name: true } } } })

  const histories: Promise<void>[] = []
  if (status && status !== prev.status) {
    histories.push(logActivity({ actorId: req.user!.userId, eventType: 'project_status_changed', entityType: 'project', entityId: project.id, entityName: project.name, meta: { from_status: prev.status, to_status: status } }))
    histories.push(logProjectHistory({ projectId: project.id, actorId: req.user!.userId, eventType: 'status_changed', description: `Estado cambiado de ${prev.status} a ${status}`, meta: { from_status: prev.status, to_status: status } }))
  }
  if (estimatedClose !== undefined && String(prev.estimatedClose ?? '') !== String(estimatedClose ?? '')) {
    histories.push(logProjectHistory({ projectId: project.id, actorId: req.user!.userId, eventType: 'end_date_changed', description: `Fecha de cierre modificada`, meta: { from: prev.estimatedClose, to: estimatedClose } }))
  }
  await Promise.all(histories)
  res.json(project)
})

// ── GET /projects/:id/members ────────────────────────────────────────────────

projectsRouter.get('/:id/members', isAuth, async (req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const members = await prisma.projectMember.findMany({
    where: { projectId: req.params.id },
    include: { user: { select: { id: true, name: true, area: true, role: true } } },
    orderBy: [{ roleInProject: 'asc' }, { addedAt: 'asc' }],
  })

  const enriched = await Promise.all(members.map(async m => {
    const [active, completed, nextDue, overdueCount, blockedCount] = await Promise.all([
      prisma.task.count({ where: { projectId: req.params.id, assignedTo: m.userId, status: { not: 'COMPLETED' } } }),
      prisma.task.count({ where: { projectId: req.params.id, assignedTo: m.userId, status: 'COMPLETED' } }),
      prisma.task.findFirst({ where: { projectId: req.params.id, assignedTo: m.userId, status: { not: 'COMPLETED' }, dueDate: { not: null } }, orderBy: { dueDate: 'asc' }, select: { dueDate: true, title: true } }),
      prisma.task.count({ where: { projectId: req.params.id, assignedTo: m.userId, status: { not: 'COMPLETED' }, dueDate: { lt: today } } }),
      prisma.task.count({ where: { projectId: req.params.id, assignedTo: m.userId, status: 'BLOCKED' } }),
    ])
    return { ...m, activeTasks: active, completedTasks: completed, nextDue, overdueCount, blockedCount }
  }))

  res.json(enriched)
})

// ── POST /projects/:id/members ───────────────────────────────────────────────

projectsRouter.post('/:id/members', isAdmin, async (req, res) => {
  const { userId, roleInProject = 'executor' } = req.body
  if (!userId) { res.status(400).json({ error: 'userId requerido' }); return }

  if (roleInProject === 'lead') {
    const existingLead = await prisma.projectMember.findFirst({ where: { projectId: req.params.id, roleInProject: 'lead' } })
    if (existingLead && existingLead.userId !== userId) {
      res.status(400).json({ error: 'Ya existe un lead en este proyecto. Cambia el rol del lead actual primero.' }); return
    }
  }

  const member = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: req.params.id, userId } },
    create: { projectId: req.params.id, userId, roleInProject, addedById: req.user!.userId },
    update: { roleInProject },
    include: { user: { select: { id: true, name: true, area: true } } },
  })

  const roleLabel = roleInProject === 'lead' ? 'Lead' : 'Executor'
  await logProjectHistory({
    projectId: req.params.id, actorId: req.user!.userId, eventType: 'member_added',
    description: `${member.user.name} agregado como ${roleLabel}`,
    meta: { userId, roleInProject },
  })

  res.status(201).json(member)
})

// ── PATCH /projects/:id/members/:userId ──────────────────────────────────────

projectsRouter.patch('/:id/members/:userId', isAdmin, async (req, res) => {
  const { roleInProject } = req.body
  const member = await prisma.projectMember.update({
    where: { projectId_userId: { projectId: req.params.id, userId: req.params.userId } },
    data: { roleInProject },
    include: { user: { select: { id: true, name: true } } },
  })
  res.json(member)
})

// ── DELETE /projects/:id/members/:userId ─────────────────────────────────────

projectsRouter.delete('/:id/members/:userId', isAdmin, async (req, res) => {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: req.params.id, userId: req.params.userId } },
    include: { user: { select: { name: true } } },
  })
  if (!member) { res.status(404).json({ error: 'Miembro no encontrado' }); return }
  await prisma.projectMember.delete({ where: { projectId_userId: { projectId: req.params.id, userId: req.params.userId } } })
  await logProjectHistory({
    projectId: req.params.id, actorId: req.user!.userId, eventType: 'member_removed',
    description: `${member.user.name} removido del proyecto`,
    meta: { userId: req.params.userId },
  })
  res.json({ ok: true })
})

// ── GET /projects/:id/history ────────────────────────────────────────────────

projectsRouter.get('/:id/history', isAuth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 30, 100)
  const offset = parseInt(req.query.offset as string) || 0
  const eventType = req.query.event_type as string | undefined

  const where = {
    projectId: req.params.id,
    ...(eventType ? { eventType: eventType as any } : {}),
  }

  const [entries, total] = await Promise.all([
    prisma.projectHistory.findMany({
      where,
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.projectHistory.count({ where }),
  ])

  res.json({
    entries: entries.map(e => ({ ...e, relativeTime: relativeTime(e.createdAt) })),
    total,
    hasMore: offset + limit < total,
  })
})
