import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdminOrLead } from '../middleware/auth'
import { TaskStatus, TaskType } from '@prisma/client'
import { logActivity } from '../lib/activityLogger'
import { logProjectHistory } from '../lib/projectHistory'
import { sendTaskAssignedEmail, sendTaskStatusChangedEmail } from '../lib/email'
import { getSettings } from '../lib/settings'
import { notifyTaskAssigned, notifyTaskStatusChanged } from '../lib/whatsapp'

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

// Prisma include shape for task assignees
const ASSIGNEE_INCLUDE = {
  user: { select: { id: true, name: true, area: true, email: true, phone: true, whatsappNotif: true, status: true } },
}

// Flatten task: transform assignees array from join-table shape to flat user objects
function flatAssignees(assignees: { user: { id: string; name: string; area: string | null; email: string; phone: string | null; whatsappNotif: boolean; status: string } }[]) {
  return assignees.map(a => a.user)
}

// Only ACTIVE users receive email/whatsapp notifications
function activeOnly<T extends { status: string }>(users: T[]): T[] {
  return users.filter(u => u.status === 'ACTIVE')
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

  const baseWhere = { assignees: { some: { userId } }, status: { notIn: ['COMPLETED'] as TaskStatus[] } }
  const include   = {
    assignees: { include: ASSIGNEE_INCLUDE },
    project:   { include: { client: { select: { id: true, name: true } } } },
  }
  const [todayTasks, pending, overdue] = await Promise.all([
    prisma.task.findMany({ where: { ...baseWhere, dueDate: { gte: today, lt: tomorrow } }, include, orderBy: { dueDate: 'asc' } }),
    prisma.task.findMany({ where: { ...baseWhere, OR: [{ dueDate: null }, { dueDate: { gte: tomorrow } }] }, include, orderBy: { dueDate: 'asc' } }),
    prisma.task.findMany({ where: { ...baseWhere, dueDate: { lt: today } }, include, orderBy: { dueDate: 'asc' } }),
  ])

  res.json({
    today:   todayTasks.map(t => ({ ...t, assignees: flatAssignees(t.assignees) })),
    pending: pending.map(t => ({ ...t, assignees: flatAssignees(t.assignees) })),
    overdue: overdue.map(t => ({ ...t, assignees: flatAssignees(t.assignees) })),
  })
})

// ── GET /my/count ─────────────────────────────────────────────────────────────

tasksRouter.get('/my/count', isAuth, async (req, res) => {
  const { userId } = req.user!
  const today    = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const count = await prisma.task.count({
    where: { assignees: { some: { userId } }, status: { notIn: ['COMPLETED'] }, dueDate: { lt: tomorrow } },
  })
  res.json({ count })
})

// ── GET /project/:projectId ───────────────────────────────────────────────────

tasksRouter.get('/project/:projectId', isAuth, async (req, res) => {
  const { user } = req
  const isAdminOrLead = user!.role === 'ADMIN' || user!.role === 'LEAD'
  const tasks = await prisma.task.findMany({
    where: {
      projectId: req.params.projectId,
      ...(!isAdminOrLead ? { assignees: { some: { userId: user!.userId } } } : {}),
    },
    include: { assignees: { include: ASSIGNEE_INCLUDE } },
    orderBy: { createdAt: 'asc' },
  })
  res.json(tasks.map(t => ({ ...t, assignees: flatAssignees(t.assignees) })))
})

// ── POST / ────────────────────────────────────────────────────────────────────

tasksRouter.post('/', isAuth, async (req, res) => {
  const { userId, role } = req.user!
  const { title, description, projectId, assignees: assigneeIds, dueDate, taskType } = req.body
  if (!title || !projectId) { res.status(400).json({ error: 'Título y proyecto son requeridos' }); return }

  const settings = await getSettings()
  if (role === 'TEAM' && settings.allow_team_create_tasks !== 'true') {
    res.status(403).json({ error: 'Los usuarios Team no pueden crear tareas en este sistema' }); return
  }
  if (role !== 'ADMIN' && role !== 'LEAD') {
    // TEAM can only create tasks assigned to themselves
    const ids: string[] = Array.isArray(assigneeIds) ? assigneeIds : (assigneeIds ? [assigneeIds] : [])
    if (ids.some(id => id !== userId)) {
      res.status(403).json({ error: 'Solo puedes crear tareas asignadas a ti mismo' }); return
    }
  }
  if (settings.require_task_type === 'true' && !taskType) {
    res.status(400).json({ error: 'El tipo de tarea es obligatorio' }); return
  }

  // Normalize assignees list
  let effectiveAssignees: string[] = Array.isArray(assigneeIds) ? assigneeIds : (assigneeIds ? [assigneeIds] : [])
  // Auto-assign to creator if setting is on and no assignee provided
  if (effectiveAssignees.length === 0 && settings.auto_assign_to_creator === 'true') {
    effectiveAssignees = [userId]
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { client: { select: { name: true } } },
  })

  const task = await prisma.task.create({
    data: {
      title, description, projectId,
      dueDate:   dueDate ? new Date(dueDate) : null,
      taskType:  taskType as TaskType | undefined ?? null,
      assignees: effectiveAssignees.length > 0
        ? { create: effectiveAssignees.map(uid => ({ userId: uid, assignedBy: userId })) }
        : undefined,
    },
    include: { assignees: { include: ASSIGNEE_INCLUDE }, project: { select: { id: true, name: true } } },
  })

  const taskAssignees = flatAssignees(task.assignees)

  await logActivity({ actorId: userId, eventType: 'task_created', entityType: 'task', entityId: task.id, entityName: task.title, meta: { project_id: projectId, project_name: project?.name } })
  await logProjectHistory({ projectId, actorId: userId, eventType: 'task_created', description: `Tarea "${task.title}" creada${taskAssignees.length ? ` y asignada a ${taskAssignees.map(a => a.name).join(', ')}` : ''}`, meta: { taskId: task.id } })

  if (effectiveAssignees.length > 0) {
    await logActivity({ actorId: userId, eventType: 'task_assigned', entityType: 'task', entityId: task.id, entityName: task.title, meta: { assigned_to: effectiveAssignees, project_name: project?.name } })
    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

    for (const assignee of activeOnly(taskAssignees)) {
      await ensureMember(projectId, assignee.id, userId)
      // Email (fire-and-forget)
      sendTaskAssignedEmail({
        to:            assignee.email,
        recipientName: assignee.name,
        assignerName:  actor?.name ?? 'Un admin',
        taskTitle:     task.title,
        taskTypeLabel: taskType ? TASK_TYPE_LABEL[taskType] : null,
        projectName:   project?.name ?? '',
        clientName:    project?.client?.name ?? '',
        dueDate:       task.dueDate ?? null,
        projectId,
      }).catch(console.error)
      // WhatsApp (fire-and-forget)
      notifyTaskAssigned({
        user:        { phone: assignee.phone ?? null, whatsappNotif: assignee.whatsappNotif },
        taskTitle:   task.title,
        projectName: project?.name ?? '',
        dueDate:     task.dueDate,
      }).catch(console.error)
    }
  }

  res.status(201).json({ ...task, assignees: taskAssignees })
})

// ── PATCH /:id ────────────────────────────────────────────────────────────────

tasksRouter.patch('/:id', isAuth, async (req, res) => {
  const { user } = req
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: {
      project:  { select: { name: true, id: true } },
      assignees: { include: ASSIGNEE_INCLUDE },
    },
  })
  if (!task) { res.status(404).json({ error: 'Tarea no encontrada' }); return }

  const isAssigned = task.assignees.some(a => a.userId === user!.userId)
  if (user!.role !== 'ADMIN' && user!.role !== 'LEAD' && !isAssigned) {
    res.status(403).json({ error: 'No autorizado' }); return
  }

  const { title, description, status, dueDate, assignees: newAssigneeIds, taskType } = req.body
  const data: Record<string, unknown> = {}
  if (title)                     data.title       = title
  if (description !== undefined) data.description = description
  if (taskType !== undefined)    data.taskType    = taskType as TaskType | null
  if (status) {
    data.status = status as TaskStatus
    if (status === 'COMPLETED' && task.status !== 'COMPLETED') data.completedAt = new Date()
    else if (status !== 'COMPLETED') data.completedAt = null
  }
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null

  const updated = await prisma.task.update({
    where: { id: req.params.id },
    data,
    include: {
      assignees: { include: ASSIGNEE_INCLUDE },
      project:   { include: { client: { select: { name: true } } } },
    },
  })

  // Replace assignees if admin/lead provided a new list
  if (newAssigneeIds !== undefined && (user!.role === 'ADMIN' || user!.role === 'LEAD')) {
    const ids: string[] = Array.isArray(newAssigneeIds) ? newAssigneeIds : (newAssigneeIds ? [newAssigneeIds] : [])
    const prevIds = task.assignees.map(a => a.userId)
    const addedIds   = ids.filter(id => !prevIds.includes(id))
    const removedIds = prevIds.filter(id => !ids.includes(id))

    if (removedIds.length > 0) {
      await prisma.taskAssignee.deleteMany({ where: { taskId: task.id, userId: { in: removedIds } } })
    }
    if (addedIds.length > 0) {
      await prisma.taskAssignee.createMany({
        data: addedIds.map(uid => ({ taskId: task.id, userId: uid, assignedBy: user!.userId })),
        skipDuplicates: true,
      })
    }

    // Re-fetch updated task with new assignees
    const refreshed = await prisma.task.findUnique({
      where: { id: task.id },
      include: { assignees: { include: ASSIGNEE_INCLUDE }, project: { include: { client: { select: { name: true } } } } },
    })

    if (addedIds.length > 0) {
      await logActivity({ actorId: user!.userId, eventType: 'task_assigned', entityType: 'task', entityId: task.id, entityName: task.title, meta: { added: addedIds, removed: removedIds, project_name: task.project.name } })

      const newAssignees = activeOnly(flatAssignees(refreshed?.assignees ?? []).filter(a => addedIds.includes(a.id)))
      const actor = await prisma.user.findUnique({ where: { id: user!.userId }, select: { name: true } })

      for (const assignee of newAssignees) {
        await ensureMember(task.projectId, assignee.id, user!.userId)
        sendTaskAssignedEmail({
          to:            assignee.email,
          recipientName: assignee.name,
          assignerName:  actor?.name ?? 'Un admin',
          taskTitle:     task.title,
          taskTypeLabel: updated.taskType ? TASK_TYPE_LABEL[updated.taskType] : null,
          projectName:   task.project.name,
          clientName:    refreshed?.project.client?.name ?? '',
          dueDate:       updated.dueDate ?? null,
          projectId:     task.projectId,
        }).catch(console.error)
        notifyTaskAssigned({
          user:        { phone: assignee.phone ?? null, whatsappNotif: assignee.whatsappNotif },
          taskTitle:   task.title,
          projectName: task.project.name,
          dueDate:     updated.dueDate,
        }).catch(console.error)
      }
    }

    if (refreshed) {
      return res.json({ ...refreshed, assignees: flatAssignees(refreshed.assignees) })
    }
  }

  // Log status change
  if (status && status !== task.status) {
    await logActivity({ actorId: user!.userId, eventType: 'task_status_changed', entityType: 'task', entityId: task.id, entityName: task.title, meta: { from_status: task.status, to_status: status, project_name: task.project.name } })
    await logProjectHistory({ projectId: task.projectId, actorId: user!.userId, eventType: 'task_status_changed', description: `"${task.title}" movida de ${task.status} a ${status}`, meta: { taskId: task.id } })

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

    // WhatsApp to all assignees except the changer
    for (const a of updated.assignees) {
      if (a.userId === user!.userId) continue
      notifyTaskStatusChanged({
        user:        { phone: a.user.phone ?? null, whatsappNotif: a.user.whatsappNotif },
        taskTitle:   task.title,
        fromStatus:  task.status,
        toStatus:    status,
        changerName: actor?.name ?? 'Usuario',
      }).catch(console.error)
    }
  }

  res.json({ ...updated, assignees: flatAssignees(updated.assignees) })
})

// ── PATCH /:id/status (drag & drop) ──────────────────────────────────────────

tasksRouter.patch('/:id/status', isAuth, async (req, res) => {
  const { status } = req.body
  if (!status) { res.status(400).json({ error: 'Status requerido' }); return }

  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: { project: { include: { client: { select: { name: true } } } }, assignees: { select: { userId: true } } },
  })
  if (!task) { res.status(404).json({ error: 'Tarea no encontrada' }); return }

  const isAssigned = task.assignees.some(a => a.userId === req.user!.userId)
  if (req.user!.role !== 'ADMIN' && req.user!.role !== 'LEAD' && !isAssigned) {
    res.status(403).json({ error: 'No autorizado' }); return
  }

  const completedAt = status === 'COMPLETED' && task.status !== 'COMPLETED' ? new Date()
    : status !== 'COMPLETED' ? null : task.completedAt

  const updated = await prisma.task.update({
    where: { id: req.params.id },
    data:  { status: status as TaskStatus, completedAt },
    include: { assignees: { include: ASSIGNEE_INCLUDE } },
  })

  await logActivity({ actorId: req.user!.userId, eventType: 'task_status_changed', entityType: 'task', entityId: task.id, entityName: task.title, meta: { from_status: task.status, to_status: status, project_name: task.project.name } })
  await logProjectHistory({ projectId: task.projectId, actorId: req.user!.userId, eventType: 'task_status_changed', description: `"${task.title}" movida de ${task.status} a ${status}`, meta: { taskId: task.id } })

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

  // WhatsApp to all assignees except the changer
  for (const a of updated.assignees) {
    if (a.userId === req.user!.userId) continue
    notifyTaskStatusChanged({
      user:        { phone: a.user.phone ?? null, whatsappNotif: a.user.whatsappNotif },
      taskTitle:   task.title,
      fromStatus:  task.status,
      toStatus:    status,
      changerName: actor?.name ?? 'Usuario',
    }).catch(console.error)
  }

  res.json({ ...updated, assignees: flatAssignees(updated.assignees) })
})

// ── PATCH /:id/reopen ─────────────────────────────────────────────────────────

tasksRouter.patch('/:id/reopen', isAuth, async (req, res) => {
  const { userId, role } = req.user!
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: { assignees: { select: { userId: true } } },
  })
  if (!task) { res.status(404).json({ error: 'Tarea no encontrada' }); return }

  if (role !== 'ADMIN' && role !== 'LEAD') {
    const reopenSettings = await getSettings()
    const isAssigned = task.assignees.some(a => a.userId === userId)
    if (reopenSettings.allow_team_reopen_tasks !== 'true' || !isAssigned) {
      res.status(403).json({ error: 'No autorizado para reabrir esta tarea' }); return
    }
  }

  const updated = await prisma.task.update({
    where: { id: req.params.id },
    data:  { status: 'PENDING', completedAt: null },
    include: { assignees: { include: ASSIGNEE_INCLUDE } },
  })

  await logProjectHistory({
    projectId: task.projectId, actorId: userId,
    eventType: 'task_status_changed',
    description: `"${task.title}" reabierta`,
    meta: { taskId: task.id, from_status: 'COMPLETED', to_status: 'PENDING' },
  })

  res.json({ ...updated, assignees: flatAssignees(updated.assignees) })
})

// ── DELETE /:id ───────────────────────────────────────────────────────────────

tasksRouter.delete('/:id', isAuth, async (req, res) => {
  const { userId, role } = req.user!
  if (role !== 'ADMIN' && role !== 'LEAD') {
    const delSettings = await getSettings()
    if (delSettings.allow_team_delete_tasks !== 'true') {
      res.status(403).json({ error: 'No tienes permiso para eliminar tareas' }); return
    }
  }

  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    select: { id: true, title: true, projectId: true },
  })
  if (!task) { res.status(404).json({ error: 'Tarea no encontrada' }); return }

  await prisma.task.delete({ where: { id: task.id } })

  await logProjectHistory({
    projectId: task.projectId, actorId: userId,
    eventType: 'task_status_changed',
    description: `Tarea "${task.title}" eliminada`,
    meta: { taskId: task.id, action: 'deleted' },
  })

  res.json({ ok: true })
})
