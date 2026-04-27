import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdmin, isAdminOrLead } from '../middleware/auth'
import { TaskStatus, TaskType } from '@prisma/client'
import { logActivity } from '../lib/activityLogger'
import { logProjectHistory } from '../lib/projectHistory'
import { sendTaskAssignedEmail, sendTaskStatusChangedEmail } from '../lib/email'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TASK_TYPE_LABEL: Record<string, string> = {
  DISENO:          'Diseño',
  EDICION_VIDEO:   'Edición de video',
  ESTRATEGIA:      'Estrategia',
  PROPUESTA:       'Propuesta',
  PRODUCCION:      'Producción',
  POST_PRODUCCION: 'Post-producción',
  PRE_PRODUCCION:  'Pre-producción',
  COPY:            'Copy',
  FOTOGRAFIA:      'Fotografía',
  CONTENIDO_REDES: 'Contenido redes',
  OTRO:            'Otro',
}

// Auto-add member to project when task is assigned
async function ensureMember(projectId: string, userId: string, addedById: string) {
  const exists = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } })
  if (!exists) {
    await prisma.projectMember.create({ data: { projectId, userId, addedById } })
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    await logProjectHistory({
      projectId, actorId: addedById, eventType: 'member_added',
      description: `${user?.name ?? 'Usuario'} agregado automáticamente al asignársele una tarea`,
      meta: { userId, roleInProject: 'executor' },
    })
  }
}

// Get all admin emails (for status-change notifications)
async function getAdminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    select: { email: true },
  })
  return admins.map(a => a.email)
}

export const tasksRouter = Router()

// ── GET /my ───────────────────────────────────────────────────────────────────

tasksRouter.get('/my', isAuth, async (req, res) => {
  const { userId } = req.user!
  const today    = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const [todayTasks, pending, overdue] = await Promise.all([
    prisma.task.findMany({ where: { assignedTo: userId, status: { notIn: ['COMPLETED'] }, dueDate: { gte: today, lt: tomorrow } }, include: { project: { include: { client: { select: { id: true, name: true } } } } }, orderBy: { dueDate: 'asc' } }),
    prisma.task.findMany({ where: { assignedTo: userId, status: { notIn: ['COMPLETED'] }, OR: [{ dueDate: null }, { dueDate: { gte: tomorrow } }] }, include: { project: { include: { client: { select: { id: true, name: true } } } } }, orderBy: { dueDate: 'asc' } }),
    prisma.task.findMany({ where: { assignedTo: userId, status: { notIn: ['COMPLETED'] }, dueDate: { lt: today } }, include: { project: { include: { client: { select: { id: true, name: true } } } } }, orderBy: { dueDate: 'asc' } }),
  ])
  res.json({ today: todayTasks, pending, overdue })
})

// ── GET /my/count ─────────────────────────────────────────────────────────────

tasksRouter.get('/my/count', isAuth, async (req, res) => {
  const { userId } = req.user!
  const today    = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const count = await prisma.task.count({
    where: { assignedTo: userId, status: { notIn: ['COMPLETED'] }, dueDate: { lt: tomorrow } },
  })
  res.json({ count })
})

// ── GET /project/:projectId ───────────────────────────────────────────────────

tasksRouter.get('/project/:projectId', isAuth, async (req, res) => {
  const { user } = req
  const tasks = await prisma.task.findMany({
    where: { projectId: req.params.projectId, ...(user!.role !== 'ADMIN' && user!.role !== 'LEAD' ? { assignedTo: user!.userId } : {}) },
    include: { assignee: { select: { id: true, name: true, area: true } } },
    orderBy: { createdAt: 'asc' },
  })
  res.json(tasks)
})

// ── POST / ────────────────────────────────────────────────────────────────────

tasksRouter.post('/', isAdminOrLead, async (req, res) => {
  const { title, description, projectId, assignedTo, dueDate, taskType } = req.body
  if (!title || !projectId) { res.status(400).json({ error: 'Título y proyecto son requeridos' }); return }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { client: { select: { name: true } } },
  })

  const task = await prisma.task.create({
    data: {
      title, description, projectId,
      assignedTo:  assignedTo || null,
      dueDate:     dueDate ? new Date(dueDate) : null,
      taskType:    taskType as TaskType | undefined ?? null,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, area: true } },
      project:  { select: { id: true, name: true } },
    },
  })

  await logActivity({ actorId: req.user!.userId, eventType: 'task_created', entityType: 'task', entityId: task.id, entityName: task.title, meta: { project_id: projectId, project_name: project?.name } })
  await logProjectHistory({ projectId, actorId: req.user!.userId, eventType: 'task_created', description: `Tarea "${task.title}" creada${task.assignee ? ` y asignada a ${task.assignee.name}` : ''}`, meta: { taskId: task.id } })

  if (assignedTo && task.assignee) {
    await logActivity({ actorId: req.user!.userId, eventType: 'task_assigned', entityType: 'task', entityId: task.id, entityName: task.title, meta: { assigned_to: assignedTo, project_name: project?.name } })
    await ensureMember(projectId, assignedTo, req.user!.userId)

    // Fire-and-forget email to assignee
    const actor = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true } })
    sendTaskAssignedEmail({
      to:            task.assignee.email,
      recipientName: task.assignee.name,
      assignerName:  actor?.name ?? 'Un admin',
      taskTitle:     task.title,
      taskTypeLabel: taskType ? TASK_TYPE_LABEL[taskType] : null,
      projectName:   project?.name ?? '',
      clientName:    project?.client?.name ?? '',
      dueDate:       task.dueDate ?? null,
      projectId,
    }).catch(console.error)
  }

  res.status(201).json(task)
})

// ── PATCH /:id ────────────────────────────────────────────────────────────────

tasksRouter.patch('/:id', isAuth, async (req, res) => {
  const { user } = req
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: {
      project:  { select: { name: true, id: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
  })
  if (!task) { res.status(404).json({ error: 'Tarea no encontrada' }); return }
  if (user!.role !== 'ADMIN' && user!.role !== 'LEAD' && task.assignedTo !== user!.userId) {
    res.status(403).json({ error: 'No autorizado' }); return
  }

  const { title, description, status, dueDate, assignedTo, taskType } = req.body
  const data: Record<string, unknown> = {}
  if (title)                   data.title       = title
  if (description !== undefined) data.description = description
  if (taskType !== undefined)  data.taskType    = taskType as TaskType | null
  if (status) {
    data.status = status as TaskStatus
    if (status === 'COMPLETED' && task.status !== 'COMPLETED') data.completedAt = new Date()
    else if (status !== 'COMPLETED') data.completedAt = null
  }
  if (dueDate !== undefined)  data.dueDate    = dueDate ? new Date(dueDate) : null
  if (assignedTo !== undefined && (user!.role === 'ADMIN' || user!.role === 'LEAD')) {
    data.assignedTo = assignedTo || null
  }

  const updated = await prisma.task.update({
    where: { id: req.params.id },
    data,
    include: {
      assignee: { select: { id: true, name: true, email: true, area: true } },
      project:  { include: { client: { select: { name: true } } } },
    },
  })

  // Log status change
  if (status && status !== task.status) {
    await logActivity({ actorId: user!.userId, eventType: 'task_status_changed', entityType: 'task', entityId: task.id, entityName: task.title, meta: { from_status: task.status, to_status: status, project_name: task.project.name } })
    await logProjectHistory({ projectId: task.projectId, actorId: user!.userId, eventType: 'task_status_changed', description: `"${task.title}" movida de ${task.status} a ${status}`, meta: { taskId: task.id } })

    // Email admins about status change
    const [adminEmails, actor] = await Promise.all([
      getAdminEmails(),
      prisma.user.findUnique({ where: { id: user!.userId }, select: { name: true } }),
    ])
    sendTaskStatusChangedEmail({
      adminEmails,
      changerName:  actor?.name ?? 'Usuario',
      taskTitle:    task.title,
      projectName:  task.project.name,
      clientName:   updated.project.client?.name ?? '',
      fromStatus:   task.status,
      toStatus:     status,
      projectId:    task.projectId,
    }).catch(console.error)
  }

  // Log assignment change + email new assignee
  if (assignedTo !== undefined && (user!.role === 'ADMIN' || user!.role === 'LEAD') && assignedTo !== task.assignedTo) {
    await logActivity({ actorId: user!.userId, eventType: 'task_assigned', entityType: 'task', entityId: task.id, entityName: task.title, meta: { assigned_to: assignedTo, project_name: task.project.name } })
    if (assignedTo) {
      await ensureMember(task.projectId, assignedTo, user!.userId)
      const [newAssignee, actor] = await Promise.all([
        prisma.user.findUnique({ where: { id: assignedTo }, select: { name: true, email: true } }),
        prisma.user.findUnique({ where: { id: user!.userId }, select: { name: true } }),
      ])
      if (newAssignee) {
        sendTaskAssignedEmail({
          to:            newAssignee.email,
          recipientName: newAssignee.name,
          assignerName:  actor?.name ?? 'Un admin',
          taskTitle:     task.title,
          taskTypeLabel: updated.taskType ? TASK_TYPE_LABEL[updated.taskType] : null,
          projectName:   task.project.name,
          clientName:    updated.project.client?.name ?? '',
          dueDate:       updated.dueDate ?? null,
          projectId:     task.projectId,
        }).catch(console.error)
      }
    }
  }

  res.json(updated)
})

// ── PATCH /:id/status (drag & drop) ──────────────────────────────────────────

tasksRouter.patch('/:id/status', isAuth, async (req, res) => {
  const { status } = req.body
  if (!status) { res.status(400).json({ error: 'Status requerido' }); return }

  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: { project: { include: { client: { select: { name: true } } } } },
  })
  if (!task) { res.status(404).json({ error: 'Tarea no encontrada' }); return }
  if (req.user!.role !== 'ADMIN' && req.user!.role !== 'LEAD' && task.assignedTo !== req.user!.userId) {
    res.status(403).json({ error: 'No autorizado' }); return
  }

  const completedAt = status === 'COMPLETED' && task.status !== 'COMPLETED' ? new Date()
    : status !== 'COMPLETED' ? null : task.completedAt

  const updated = await prisma.task.update({
    where: { id: req.params.id },
    data: { status: status as TaskStatus, completedAt },
    include: { assignee: { select: { id: true, name: true } } },
  })

  await logActivity({ actorId: req.user!.userId, eventType: 'task_status_changed', entityType: 'task', entityId: task.id, entityName: task.title, meta: { from_status: task.status, to_status: status, project_name: task.project.name } })
  await logProjectHistory({ projectId: task.projectId, actorId: req.user!.userId, eventType: 'task_status_changed', description: `"${task.title}" movida de ${task.status} a ${status}`, meta: { taskId: task.id } })

  // Email admins (fire-and-forget)
  const [adminEmails, actor] = await Promise.all([
    getAdminEmails(),
    prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true } }),
  ])
  sendTaskStatusChangedEmail({
    adminEmails,
    changerName:  actor?.name ?? 'Usuario',
    taskTitle:    task.title,
    projectName:  task.project.name,
    clientName:   task.project.client?.name ?? '',
    fromStatus:   task.status,
    toStatus:     status,
    projectId:    task.projectId,
  }).catch(console.error)

  res.json(updated)
})
