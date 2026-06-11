import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdminOrLead } from '../middleware/auth'
import { TaskStatus, TaskType } from '@prisma/client'
import { logActivity } from '../lib/activityLogger'
import { logProjectHistory } from '../lib/projectHistory'
import { sendTaskAssignedEmail, sendTaskStatusChangedEmail, sendGenericEmail } from '../lib/email'
import { getSettings } from '../lib/settings'
import { createNotification, createNotifications } from '../lib/notify'
import { getOrgId } from '../lib/orgContext'

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
  user: { select: { id: true, name: true, area: true, email: true, status: true } },
}

// Flatten task: transform assignees array from join-table shape to flat user objects
function flatAssignees(assignees: { user: { id: string; name: string; area: string | null; email: string; status: string } }[]) {
  return assignees.map(a => a.user)
}

// Only ACTIVE users receive email notifications
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

// Check if all production tasks for a brief are done → notify admins
async function checkBriefProductionComplete(briefId: string, actorName: string) {
  const tasks = await prisma.task.findMany({ where: { briefId }, select: { status: true } })
  if (tasks.length === 0) return
  const allDone = tasks.every(t => t.status === 'COMPLETED')
  if (!allDone) return

  const brief = await prisma.contentBrief.findUnique({
    where: { id: briefId },
    select: { title: true, client: { select: { name: true } } },
  })
  if (!brief) return

  const adminEmails = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'LEAD'] }, status: 'ACTIVE' },
    select: { email: true },
  }).then(rows => rows.map(r => r.email))

  for (const email of adminEmails) {
    sendGenericEmail({
      to: email,
      subject: `✅ Producción completada — ${brief.title}`,
      html: `<p>Todas las tareas de producción del brief <strong>${brief.title}</strong> (${brief.client.name}) han sido marcadas como completadas por ${actorName}.</p>`,
    }).catch(console.error)
  }
}

// Get all admin emails (for status-change notifications)
async function getAdminEmails(excludeUserId?: string): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE', ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
    select: { email: true },
  })
  return admins.map(a => a.email)
}

async function getAdminAndLeadIds(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'LEAD'] }, status: 'ACTIVE' },
    select: { id: true },
  })
  return users.map(u => u.id)
}

export const tasksRouter = Router()

// ── GET /my ───────────────────────────────────────────────────────────────────

tasksRouter.get('/my', isAuth, async (req, res) => {
  const { userId } = req.user!
  const today    = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

  const baseWhere = { organizationId: getOrgId(req), assignees: { some: { userId } }, status: { notIn: ['COMPLETED'] as TaskStatus[] } }
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
    where: { organizationId: getOrgId(req), assignees: { some: { userId } }, status: { notIn: ['COMPLETED'] }, dueDate: { lt: tomorrow } },
  })
  res.json({ count })
})

// ── GET /project/:projectId ───────────────────────────────────────────────────

tasksRouter.get('/project/:projectId', isAuth, async (req, res) => {
  const { user } = req
  const isAdminOrLead = user!.role === 'ADMIN' || user!.role === 'LEAD'
  const tasks = await prisma.task.findMany({
    where: {
      organizationId: getOrgId(req),
      projectId: req.params.projectId,
      ...(!isAdminOrLead ? { assignees: { some: { userId: user!.userId } } } : {}),
    },
    include: {
      assignees: { include: ASSIGNEE_INCLUDE },
      brief: { select: { id: true, title: true, scripts: { select: { id: true, title: true, status: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  })
  res.json(tasks.map(t => ({ ...t, assignees: flatAssignees(t.assignees) })))
})

// ── POST /bulk ────────────────────────────────────────────────────────────────

tasksRouter.post('/bulk', isAuth, async (req, res) => {
  const { userId, role } = req.user!
  const { projectId, tasks: rows } = req.body as { projectId: string; tasks: { title: string; taskType?: string; assignees?: string[]; dueDate?: string }[] }

  if (!projectId) { res.status(400).json({ error: 'projectId requerido' }); return }
  if (!Array.isArray(rows) || rows.length === 0) { res.status(400).json({ error: 'Se requiere al menos una tarea' }); return }

  const settings = await getSettings()
  if (role === 'TEAM' && settings.allow_team_create_tasks !== 'true') {
    res.status(403).json({ error: 'Los usuarios Team no pueden crear tareas' }); return
  }

  const valid = rows.filter(r => typeof r.title === 'string' && r.title.trim().length > 0)
  if (valid.length === 0) { res.status(400).json({ error: 'No hay tareas válidas' }); return }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { client: { select: { name: true } } },
  })
  if (!project) { res.status(404).json({ error: 'Proyecto no encontrado' }); return }

  const created = await prisma.$transaction(
    valid.map(r =>
      prisma.task.create({
        data: {
          title:     r.title.trim(),
          projectId,
          dueDate:   r.dueDate ? new Date(r.dueDate) : null,
          taskType:  (r.taskType as TaskType | undefined) ?? null,
          organizationId: getOrgId(req),
          assignees: r.assignees && r.assignees.length > 0
            ? { create: r.assignees.map(uid => ({ userId: uid, assignedBy: userId })) }
            : undefined,
        },
        include: { assignees: { include: ASSIGNEE_INCLUDE }, project: { select: { id: true, name: true } } },
      })
    )
  )

  // Log history once for the batch
  await logProjectHistory({
    projectId, actorId: userId,
    eventType: 'task_created',
    description: `${created.length} tarea${created.length !== 1 ? 's' : ''} creada${created.length !== 1 ? 's' : ''} en masa`,
    meta: { count: created.length, taskIds: created.map(t => t.id) },
  })

  // Gather all unique assignees across all tasks and notify
  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  const actorName = actor?.name ?? 'Un admin'

  // Collect per-assignee: list of task titles they were assigned to
  const assigneeTaskMap = new Map<string, { assignee: ReturnType<typeof flatAssignees>[number]; titles: string[] }>()

  for (const task of created) {
    const taskAssignees = flatAssignees(task.assignees)
    for (const assignee of activeOnly(taskAssignees)) {
      await ensureMember(projectId, assignee.id, userId)
      if (!assigneeTaskMap.has(assignee.id)) {
        assigneeTaskMap.set(assignee.id, { assignee, titles: [] })
      }
      assigneeTaskMap.get(assignee.id)!.titles.push(task.title)
    }
  }

  for (const { assignee, titles } of assigneeTaskMap.values()) {
    // Email (one per unique task, matching old behavior)
    for (const taskTitle of titles) {
      sendTaskAssignedEmail({
        to:            assignee.email,
        recipientName: assignee.name,
        assignerName:  actorName,
        taskTitle,
        taskTypeLabel: null,
        projectName:   project.name,
        clientName:    project.client?.name ?? '',
        dueDate:       null,
        projectId,
      }).catch(console.error)
    }

    // In-app notification (skip if assignee is the creator)
    if (assignee.id !== userId) {
      const body = titles.length === 1
        ? `${actorName} te asignó "${titles[0]}" en ${project.name}`
        : `${actorName} te asignó ${titles.length} tareas en ${project.name}`
      createNotification({
        userId: assignee.id,
        type:   'task_assigned',
        title:  titles.length === 1 ? `Tarea asignada: ${titles[0]}` : `${titles.length} tareas asignadas`,
        body,
        link:   `/projects/${projectId}`,
      }).catch(console.error)
    }
  }

  res.status(201).json(created.map(t => ({ ...t, assignees: flatAssignees(t.assignees) })))
})

// ── GET /standalone ───────────────────────────────────────────────────────────

tasksRouter.get('/standalone', isAuth, async (req, res) => {
  const { userId, role } = req.user!
  const today    = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

  // Roles that the current user can view
  const viewableRoles: string[] =
    role === 'ADMIN' ? ['TEAM', 'LEAD'] :
    role === 'LEAD'  ? ['TEAM'] : []

  // Members list (users whose tasks this user can see)
  const members = viewableRoles.length > 0
    ? await prisma.user.findMany({
        where: { role: { in: viewableRoles as any }, status: 'ACTIVE' },
        select: { id: true, name: true, role: true, area: true },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      })
    : []

  // Determine which userId to filter tasks by
  const viewUserId = req.query.viewUserId as string | undefined
  let targetUserId: string | null = null

  if (!viewUserId || viewUserId === userId) {
    // Viewing own tasks
    targetUserId = userId
  } else if (viewableRoles.length > 0) {
    // Admin/Lead viewing a team member — verify they're allowed
    const member = members.find(m => m.id === viewUserId)
    if (!member) { res.status(403).json({ error: 'Sin permiso para ver este usuario' }); return }
    targetUserId = viewUserId
  } else {
    targetUserId = userId
  }

  const baseWhere = {
    organizationId: getOrgId(req),
    projectId: null,
    assignees: { some: { userId: targetUserId } },
  }
  const include = { assignees: { include: ASSIGNEE_INCLUDE } }

  const [overdue, todayTasks, pending, completed] = await Promise.all([
    prisma.task.findMany({ where: { ...baseWhere, status: { notIn: ['COMPLETED'] }, dueDate: { lt: today } }, include, orderBy: { dueDate: 'asc' } }),
    prisma.task.findMany({ where: { ...baseWhere, status: { notIn: ['COMPLETED'] }, dueDate: { gte: today, lt: tomorrow } }, include, orderBy: { dueDate: 'asc' } }),
    prisma.task.findMany({ where: { ...baseWhere, status: { notIn: ['COMPLETED'] }, OR: [{ dueDate: null }, { dueDate: { gte: tomorrow } }] }, include, orderBy: { createdAt: 'desc' } }),
    prisma.task.findMany({ where: { ...baseWhere, status: 'COMPLETED' }, include, orderBy: { completedAt: 'desc' }, take: 20 }),
  ])

  const fmt = (arr: typeof overdue) => arr.map(t => ({ ...t, assignees: flatAssignees(t.assignees) }))
  res.json({
    overdue: fmt(overdue), today: fmt(todayTasks), pending: fmt(pending), completed: fmt(completed),
    members,        // users this role can switch to
    viewUserId: targetUserId,
  })
})

// ── POST / ────────────────────────────────────────────────────────────────────

tasksRouter.post('/', isAuth, async (req, res) => {
  const { userId, role } = req.user!
  const { title, description, projectId, assignees: assigneeIds, dueDate, taskType } = req.body
  if (!title) { res.status(400).json({ error: 'El título es requerido' }); return }

  const settings = await getSettings()
  // Personal tasks (no projectId) are always allowed — any user can manage their own workload.
  // The allow_team_create_tasks setting only restricts creating tasks inside projects.
  if (role === 'TEAM' && projectId && settings.allow_team_create_tasks !== 'true') {
    res.status(403).json({ error: 'Los usuarios Team no pueden crear tareas en proyectos en este sistema' }); return
  }
  if (role !== 'ADMIN' && role !== 'LEAD') {
    const ids: string[] = Array.isArray(assigneeIds) ? assigneeIds : (assigneeIds ? [assigneeIds] : [])
    if (ids.some(id => id !== userId)) {
      res.status(403).json({ error: 'Solo puedes crear tareas asignadas a ti mismo' }); return
    }
  }
  if (settings.require_task_type === 'true' && !taskType) {
    res.status(400).json({ error: 'El tipo de tarea es obligatorio' }); return
  }

  let effectiveAssignees: string[] = Array.isArray(assigneeIds) ? assigneeIds : (assigneeIds ? [assigneeIds] : [])
  if (effectiveAssignees.length === 0 && settings.auto_assign_to_creator === 'true') {
    effectiveAssignees = [userId]
  }

  // Validate project if provided
  let project: { name: string; client: { name: string } } | null = null
  if (projectId) {
    project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { client: { select: { name: true } } },
    })
    if (!project) { res.status(404).json({ error: 'Proyecto no encontrado' }); return }
  }

  const task = await prisma.task.create({
    data: {
      title, description,
      projectId: projectId || null,
      dueDate:   dueDate ? new Date(dueDate) : null,
      taskType:  taskType as TaskType | undefined ?? null,
      organizationId: getOrgId(req),
      assignees: effectiveAssignees.length > 0
        ? { create: effectiveAssignees.map(uid => ({ userId: uid, assignedBy: userId })) }
        : undefined,
    },
    include: { assignees: { include: ASSIGNEE_INCLUDE }, project: { select: { id: true, name: true } } },
  })

  const taskAssignees = flatAssignees(task.assignees)

  await logActivity({ actorId: userId, eventType: 'task_created', entityType: 'task', entityId: task.id, entityName: task.title, meta: { project_id: projectId ?? null, project_name: project?.name ?? null } })

  if (projectId) {
    await logProjectHistory({ projectId, actorId: userId, eventType: 'task_created', description: `Tarea "${task.title}" creada${taskAssignees.length ? ` y asignada a ${taskAssignees.map(a => a.name).join(', ')}` : ''}`, meta: { taskId: task.id } })
  }

  if (effectiveAssignees.length > 0) {
    await logActivity({ actorId: userId, eventType: 'task_assigned', entityType: 'task', entityId: task.id, entityName: task.title, meta: { assigned_to: effectiveAssignees, project_name: project?.name ?? null } })
    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

    for (const assignee of activeOnly(taskAssignees)) {
      if (projectId) await ensureMember(projectId, assignee.id, userId)
      sendTaskAssignedEmail({
        to:            assignee.email,
        recipientName: assignee.name,
        assignerName:  actor?.name ?? 'Un admin',
        taskTitle:     task.title,
        taskTypeLabel: taskType ? TASK_TYPE_LABEL[taskType] : null,
        projectName:   project?.name ?? '',
        clientName:    project?.client?.name ?? '',
        dueDate:       task.dueDate ?? null,
        projectId:     projectId ?? '',
      }).catch(console.error)
      if (assignee.id !== userId) {
        createNotification({
          userId: assignee.id,
          type:   'task_assigned',
          title:  `Tarea asignada: ${task.title}`,
          body:   `${actor?.name ?? 'Un admin'} te asignó una tarea${project ? ` en ${project.name}` : ''}`,
          link:   projectId ? `/projects/${projectId}` : '/tasks',
        }).catch(console.error)
      }
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
      await logActivity({ actorId: user!.userId, eventType: 'task_assigned', entityType: 'task', entityId: task.id, entityName: task.title, meta: { added: addedIds, removed: removedIds, project_name: task.project?.name ?? '' } })

      const newAssignees = activeOnly(flatAssignees(refreshed?.assignees ?? []).filter(a => addedIds.includes(a.id)))
      const actor = await prisma.user.findUnique({ where: { id: user!.userId }, select: { name: true } })

      for (const assignee of newAssignees) {
        if (task.projectId) await ensureMember(task.projectId, assignee.id, user!.userId)
        sendTaskAssignedEmail({
          to:            assignee.email,
          recipientName: assignee.name,
          assignerName:  actor?.name ?? 'Un admin',
          taskTitle:     task.title,
          taskTypeLabel: updated.taskType ? TASK_TYPE_LABEL[updated.taskType] : null,
          projectName:   task.project?.name ?? '',
          clientName:    refreshed?.project?.client?.name ?? '',
          dueDate:       updated.dueDate ?? null,
          projectId:     task.projectId,
        }).catch(console.error)
        if (assignee.id !== user!.userId) {
          createNotification({
            userId: assignee.id,
            type:   'task_assigned',
            title:  `Tarea asignada: ${task.title}`,
            body:   `${actor?.name ?? 'Un admin'} te asignó una tarea${task.project ? ` en ${task.project.name}` : ''}`,
            link:   task.projectId ? `/projects/${task.projectId}` : '/tasks',
          }).catch(console.error)
        }
      }
    }

    if (refreshed) {
      return res.json({ ...refreshed, assignees: flatAssignees(refreshed.assignees) })
    }
  }

  // Log status change
  if (status && status !== task.status) {
    await logActivity({ actorId: user!.userId, eventType: 'task_status_changed', entityType: 'task', entityId: task.id, entityName: task.title, meta: { from_status: task.status, to_status: status, project_name: task.project?.name ?? '' } })
    if (task.projectId) {
      await logProjectHistory({ projectId: task.projectId, actorId: user!.userId, eventType: 'task_status_changed', description: `"${task.title}" movida de ${task.status} a ${status}`, meta: { taskId: task.id } })
    }

    const [adminEmails, actor] = await Promise.all([
      getAdminEmails(user!.userId),
      prisma.user.findUnique({ where: { id: user!.userId }, select: { name: true } }),
    ])
    sendTaskStatusChangedEmail({
      adminEmails,
      changerName:  actor?.name ?? 'Usuario',
      taskTitle:    task.title,
      projectName:  task.project?.name ?? '',
      clientName:   updated.project?.client?.name ?? '',
      fromStatus:   task.status,
      toStatus:     status,
      projectId:    task.projectId,
    }).catch(console.error)

    // WhatsApp to all assignees except the changer
    // In-app notifications: admins + leads + assignees (excluding changer)
    const actorName = actor?.name ?? 'Usuario'
    const assigneeIds = flatAssignees(updated.assignees).map(a => a.id)
    getAdminAndLeadIds().then(async adminIds => {
      const allTargets = [...new Set([...adminIds, ...assigneeIds])].filter(id => id !== user!.userId)
      await createNotifications(allTargets.map(userId => ({
        userId,
        type:  'task_status_changed',
        title: `Tarea actualizada: ${task.title}`,
        body:  `${actorName} cambió el estado a ${status}`,
        link:  `/projects/${task.projectId}`,
      })))
    }).catch(console.error)
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
  // capture briefId before update (it's on the raw task, Prisma includes it automatically)
  const briefId = (task as unknown as { briefId: string | null }).briefId

  const completedAt = status === 'COMPLETED' && task.status !== 'COMPLETED' ? new Date()
    : status !== 'COMPLETED' ? null : task.completedAt

  const updated = await prisma.task.update({
    where: { id: req.params.id },
    data:  { status: status as TaskStatus, completedAt },
    include: { assignees: { include: ASSIGNEE_INCLUDE } },
  })

  await logActivity({ actorId: req.user!.userId, eventType: 'task_status_changed', entityType: 'task', entityId: task.id, entityName: task.title, meta: { from_status: task.status, to_status: status, project_name: task.project?.name ?? '' } })
  await logProjectHistory({ projectId: task.projectId, actorId: req.user!.userId, eventType: 'task_status_changed', description: `"${task.title}" movida de ${task.status} a ${status}`, meta: { taskId: task.id } })

  const [adminEmails, actor] = await Promise.all([
    getAdminEmails(req.user!.userId),
    prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true } }),
  ])
  sendTaskStatusChangedEmail({
    adminEmails,
    changerName:  actor?.name ?? 'Usuario',
    taskTitle:    task.title,
    projectName:  task.project?.name ?? '',
    clientName:   task.project?.client?.name ?? '',
    fromStatus:   task.status,
    toStatus:     status,
    projectId:    task.projectId,
  }).catch(console.error)

  // In-app notifications: admins + leads + assignees (excluding changer)
  const statusActorName = actor?.name ?? 'Usuario'
  const statusAssigneeIds = flatAssignees(updated.assignees).map(a => a.id)
  getAdminAndLeadIds().then(async adminIds => {
    const allTargets = [...new Set([...adminIds, ...statusAssigneeIds])].filter(id => id !== req.user!.userId)
    await createNotifications(allTargets.map(userId => ({
      userId,
      type:  'task_status_changed',
      title: `Tarea actualizada: ${task.title}`,
      body:  `${statusActorName} cambió el estado a ${status}`,
      link:  `/projects/${task.projectId}`,
    })))
  }).catch(console.error)

  // If task has a brief and just completed, check if all brief production tasks are done
  if (status === 'COMPLETED' && briefId) {
    checkBriefProductionComplete(briefId, actor?.name ?? 'Un usuario').catch(console.error)
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
