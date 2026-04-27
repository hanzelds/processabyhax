import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAdmin } from '../middleware/auth'
import { AdminTaskStatus, AdminTaskCategory, AdminTaskPriority, RecurrenceFrequency } from '@prisma/client'

export const adminTasksRouter = Router()

// All routes require ADMIN
adminTasksRouter.use(isAdmin)

// ── helpers ───────────────────────────────────────────────────────────────────

function daysUntilDue(dueDate: Date | null): number | null {
  if (!dueDate) return null
  return Math.ceil((dueDate.getTime() - Date.now()) / 86400000)
}

function logHistory(taskId: string, actorId: string, eventType: string, description: string, meta?: object) {
  return prisma.adminTaskHistory.create({
    data: { taskId, actorId, eventType, description, meta: meta ?? undefined },
  })
}

function calculateNextGenerationAt(
  frequency: RecurrenceFrequency,
  advanceDays: number,
  from: Date = new Date(),
): Date {
  const d = new Date(from)
  switch (frequency) {
    case 'DIARIO':      d.setDate(d.getDate() + 1); break
    case 'SEMANAL':     d.setDate(d.getDate() + 7); break
    case 'MENSUAL':     d.setMonth(d.getMonth() + 1); break
    case 'TRIMESTRAL':  d.setMonth(d.getMonth() + 3); break
    case 'SEMESTRAL':   d.setMonth(d.getMonth() + 6); break
    case 'ANUAL':       d.setFullYear(d.getFullYear() + 1); break
  }
  d.setDate(d.getDate() - advanceDays)
  return d
}

function enrichTask(task: any) {
  const days = daysUntilDue(task.dueDate)
  return {
    ...task,
    daysUntilDue: days,
    isOverdue: days !== null && days < 0,
    isDueSoon: days !== null && days >= 0 && days <= 3,
  }
}

// ── GET /admin/tasks/alerts ───────────────────────────────────────────────────

adminTasksRouter.get('/alerts', async (_req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const threeDaysLater = new Date(today); threeDaysLater.setDate(today.getDate() + 4)

  const [overdue, dueSoon, blocked] = await Promise.all([
    prisma.adminTask.count({
      where: { status: { notIn: ['COMPLETADA', 'CANCELADA'] }, dueDate: { lt: today } },
    }),
    prisma.adminTask.count({
      where: { status: { notIn: ['COMPLETADA', 'CANCELADA'] }, dueDate: { gte: today, lt: threeDaysLater } },
    }),
    prisma.adminTask.count({
      where: { status: 'BLOQUEADA' },
    }),
  ])

  res.json({ overdue, dueSoon, blocked })
})

// ── GET /admin/tasks/recurrences ──────────────────────────────────────────────

adminTasksRouter.get('/recurrences', async (_req, res) => {
  const recurrences = await prisma.adminTaskRecurrence.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { tasks: true } },
    },
  })
  res.json(recurrences)
})

// ── POST /admin/tasks/recurrences ─────────────────────────────────────────────

adminTasksRouter.post('/recurrences', async (req, res) => {
  const { title, description, category, priority, frequency, dayOfMonth, monthOfYear, dayOfWeek, advanceDays } = req.body
  if (!title || !category || !frequency) {
    res.status(400).json({ error: 'title, category y frequency son requeridos' }); return
  }

  const nextGenerationAt = calculateNextGenerationAt(frequency as RecurrenceFrequency, advanceDays ?? 0)

  const recurrence = await prisma.adminTaskRecurrence.create({
    data: {
      title,
      description: description || null,
      category: category as AdminTaskCategory,
      priority: (priority as AdminTaskPriority) || 'NORMAL',
      frequency: frequency as RecurrenceFrequency,
      dayOfMonth: dayOfMonth ?? null,
      monthOfYear: monthOfYear ?? null,
      dayOfWeek: dayOfWeek ?? null,
      advanceDays: advanceDays ?? 0,
      nextGenerationAt,
      createdById: req.user!.userId,
    },
  })
  res.status(201).json(recurrence)
})

// ── PATCH /admin/tasks/recurrences/:id ───────────────────────────────────────

adminTasksRouter.patch('/recurrences/:id', async (req, res) => {
  const { title, description, category, priority, frequency, dayOfMonth, monthOfYear, dayOfWeek, advanceDays } = req.body
  const existing = await prisma.adminTaskRecurrence.findUnique({ where: { id: req.params.id } })
  if (!existing) { res.status(404).json({ error: 'Recurrencia no encontrada' }); return }

  const data: Record<string, unknown> = {}
  if (title) data.title = title
  if (description !== undefined) data.description = description || null
  if (category) data.category = category as AdminTaskCategory
  if (priority) data.priority = priority as AdminTaskPriority
  if (frequency) {
    data.frequency = frequency as RecurrenceFrequency
    data.nextGenerationAt = calculateNextGenerationAt(frequency as RecurrenceFrequency, advanceDays ?? existing.advanceDays)
  }
  if (dayOfMonth !== undefined) data.dayOfMonth = dayOfMonth ?? null
  if (monthOfYear !== undefined) data.monthOfYear = monthOfYear ?? null
  if (dayOfWeek !== undefined) data.dayOfWeek = dayOfWeek ?? null
  if (advanceDays !== undefined) data.advanceDays = advanceDays

  const updated = await prisma.adminTaskRecurrence.update({ where: { id: req.params.id }, data })
  res.json(updated)
})

// ── PATCH /admin/tasks/recurrences/:id/toggle ─────────────────────────────────

adminTasksRouter.patch('/recurrences/:id/toggle', async (req, res) => {
  const existing = await prisma.adminTaskRecurrence.findUnique({ where: { id: req.params.id } })
  if (!existing) { res.status(404).json({ error: 'Recurrencia no encontrada' }); return }
  const updated = await prisma.adminTaskRecurrence.update({
    where: { id: req.params.id },
    data: { isActive: !existing.isActive },
  })
  res.json(updated)
})

// ── DELETE /admin/tasks/recurrences/:id ───────────────────────────────────────

adminTasksRouter.delete('/recurrences/:id', async (req, res) => {
  const existing = await prisma.adminTaskRecurrence.findUnique({ where: { id: req.params.id } })
  if (!existing) { res.status(404).json({ error: 'Recurrencia no encontrada' }); return }
  // Detach tasks from recurrence before deleting
  await prisma.adminTask.updateMany({ where: { recurrenceId: req.params.id }, data: { recurrenceId: null } })
  await prisma.adminTaskRecurrence.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

// ── GET /admin/tasks ──────────────────────────────────────────────────────────

adminTasksRouter.get('/', async (req, res) => {
  const { category, priority, status, tab } = req.query

  const where: Record<string, unknown> = {}

  if (tab === 'pending') {
    where.status = { in: ['PENDIENTE', 'BLOQUEADA'] }
  } else if (tab === 'completed') {
    where.status = { in: ['COMPLETADA', 'CANCELADA'] }
  } else if (!status) {
    // Default "all" tab: non-completed, non-cancelled
    where.status = { notIn: ['COMPLETADA', 'CANCELADA'] }
  }

  if (status) where.status = status as AdminTaskStatus
  if (category) where.category = category as AdminTaskCategory
  if (priority) where.priority = priority as AdminTaskPriority

  const tasks = await prisma.adminTask.findMany({
    where,
    include: { recurrence: { select: { id: true, frequency: true } } },
    orderBy: [
      { priority: 'asc' },
      { dueDate: 'asc' },
      { createdAt: 'desc' },
    ],
  })

  res.json(tasks.map(enrichTask))
})

// ── GET /admin/tasks/:id ──────────────────────────────────────────────────────

adminTasksRouter.get('/:id', async (req, res) => {
  const task = await prisma.adminTask.findUnique({
    where: { id: req.params.id },
    include: { recurrence: true },
  })
  if (!task) { res.status(404).json({ error: 'Tarea no encontrada' }); return }
  res.json(enrichTask(task))
})

// ── GET /admin/tasks/:id/history ──────────────────────────────────────────────

adminTasksRouter.get('/:id/history', async (req, res) => {
  const history = await prisma.adminTaskHistory.findMany({
    where: { taskId: req.params.id },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  res.json(history)
})

// ── POST /admin/tasks ─────────────────────────────────────────────────────────

adminTasksRouter.post('/', async (req, res) => {
  const { title, description, category, priority, dueDate, recurrenceId } = req.body
  if (!title || !category) {
    res.status(400).json({ error: 'title y category son requeridos' }); return
  }

  const task = await prisma.adminTask.create({
    data: {
      title,
      description: description || null,
      category: category as AdminTaskCategory,
      priority: (priority as AdminTaskPriority) || 'NORMAL',
      status: 'PENDIENTE',
      dueDate: dueDate ? new Date(dueDate) : null,
      recurrenceId: recurrenceId || null,
      createdById: req.user!.userId,
    },
    include: { recurrence: { select: { id: true, frequency: true } } },
  })

  await logHistory(task.id, req.user!.userId, 'task_created', `Tarea creada por ${req.user!.name ?? 'Admin'}`)
  res.status(201).json(enrichTask(task))
})

// ── PATCH /admin/tasks/:id ────────────────────────────────────────────────────

adminTasksRouter.patch('/:id', async (req, res) => {
  const prev = await prisma.adminTask.findUnique({ where: { id: req.params.id } })
  if (!prev) { res.status(404).json({ error: 'Tarea no encontrada' }); return }
  if (prev.status === 'COMPLETADA' || prev.status === 'CANCELADA') {
    res.status(400).json({ error: 'Tarea cerrada: solo lectura' }); return
  }

  const { title, description, category, priority, dueDate } = req.body
  const data: Record<string, unknown> = {}
  if (title) data.title = title
  if (description !== undefined) data.description = description || null
  if (category) data.category = category as AdminTaskCategory
  if (priority) data.priority = priority as AdminTaskPriority
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null

  const histories: Promise<any>[] = []
  if (priority && priority !== prev.priority) {
    histories.push(logHistory(prev.id, req.user!.userId, 'priority_changed', `Prioridad cambiada de ${prev.priority} a ${priority}`, { from: prev.priority, to: priority }))
  }
  if (dueDate !== undefined && String(prev.dueDate ?? '') !== String(dueDate ?? '')) {
    histories.push(logHistory(prev.id, req.user!.userId, 'due_date_changed', `Fecha límite actualizada`, { from: prev.dueDate, to: dueDate }))
  }

  const task = await prisma.adminTask.update({
    where: { id: req.params.id },
    data,
    include: { recurrence: { select: { id: true, frequency: true } } },
  })
  await Promise.all(histories)
  res.json(enrichTask(task))
})

// ── PATCH /admin/tasks/:id/status ─────────────────────────────────────────────

adminTasksRouter.patch('/:id/status', async (req, res) => {
  const { status } = req.body
  if (!status) { res.status(400).json({ error: 'status requerido' }); return }

  const prev = await prisma.adminTask.findUnique({ where: { id: req.params.id } })
  if (!prev) { res.status(404).json({ error: 'Tarea no encontrada' }); return }
  if (prev.status === 'COMPLETADA' || prev.status === 'CANCELADA') {
    res.status(400).json({ error: 'Tarea cerrada: solo lectura' }); return
  }

  const task = await prisma.adminTask.update({
    where: { id: req.params.id },
    data: { status: status as AdminTaskStatus },
    include: { recurrence: { select: { id: true, frequency: true } } },
  })
  await logHistory(prev.id, req.user!.userId, 'status_changed', `Estado cambiado de ${prev.status} a ${status}`, { from: prev.status, to: status })
  res.json(enrichTask(task))
})

// ── PATCH /admin/tasks/:id/complete ───────────────────────────────────────────

adminTasksRouter.patch('/:id/complete', async (req, res) => {
  const { resolutionNotes } = req.body
  const prev = await prisma.adminTask.findUnique({ where: { id: req.params.id } })
  if (!prev) { res.status(404).json({ error: 'Tarea no encontrada' }); return }
  if (prev.status === 'COMPLETADA' || prev.status === 'CANCELADA') {
    res.status(400).json({ error: 'Tarea ya cerrada' }); return
  }

  const task = await prisma.adminTask.update({
    where: { id: req.params.id },
    data: {
      status: 'COMPLETADA',
      completedAt: new Date(),
      resolutionNotes: resolutionNotes || null,
    },
    include: { recurrence: { select: { id: true, frequency: true } } },
  })

  await logHistory(prev.id, req.user!.userId, 'task_completed', 'Tarea completada')

  // If recurring: generate next instance (if no open one already exists)
  if (prev.recurrenceId) {
    const recurrence = await prisma.adminTaskRecurrence.findUnique({ where: { id: prev.recurrenceId } })
    if (recurrence?.isActive) {
      const openExists = await prisma.adminTask.findFirst({
        where: { recurrenceId: prev.recurrenceId, status: { notIn: ['COMPLETADA', 'CANCELADA'] } },
      })
      if (!openExists) {
        const nextDue = calculateNextGenerationAt(recurrence.frequency, recurrence.advanceDays)
        await prisma.adminTask.create({
          data: {
            title: recurrence.title,
            description: recurrence.description,
            category: recurrence.category,
            priority: recurrence.priority,
            status: 'PENDIENTE',
            dueDate: nextDue,
            recurrenceId: recurrence.id,
            createdById: req.user!.userId,
          },
        })
        await prisma.adminTaskRecurrence.update({
          where: { id: recurrence.id },
          data: {
            lastGeneratedAt: new Date(),
            nextGenerationAt: calculateNextGenerationAt(recurrence.frequency, recurrence.advanceDays, nextDue),
          },
        })
      }
    }
  }

  res.json(enrichTask(task))
})
