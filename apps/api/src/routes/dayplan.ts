import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdmin } from '../middleware/auth'
import { TaskStatus } from '@prisma/client'

export const dayplanRouter = Router()

// ── GET / — aggregate all day items ──────────────────────────────────────────
dayplanRouter.get('/', isAuth, async (req, res) => {
  const userId  = req.user!.userId
  const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10)

  // Build local day boundaries (treat date as local YYYY-MM-DD, anchor at noon to avoid tz shifts)
  const dayStart = new Date(dateStr + 'T00:00:00.000Z')
  const dayEnd   = new Date(dateStr + 'T23:59:59.999Z')

  const [tasks, shoots, contentPieces, workBlocks] = await Promise.all([
    // Tasks with dueDate today assigned to the user (non-completed)
    prisma.task.findMany({
      where: {
        assignees: { some: { userId } },
        dueDate:   { gte: dayStart, lte: dayEnd },
        status:    { not: 'COMPLETED' },
      },
      include: {
        project: {
          select: {
            id: true, name: true,
            client: { select: { id: true, name: true, color: true } },
          },
        },
        assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        timeEntries: {
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, minutes: true, startedAt: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    }),

    // Shoots today where user is in crew
    prisma.shoot.findMany({
      where: {
        shootDate: { gte: dayStart, lte: dayEnd },
        OR: [
          { crew: { some: { userId } } },
          { createdById: userId },
        ],
      },
      include: {
        location: { select: { id: true, name: true, address: true } },
        client:   { select: { id: true, name: true, color: true } },
        crew: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { callTime: 'asc' },
        },
      },
      orderBy: { shootDate: 'asc' },
    }),

    // Content pieces scheduled today
    prisma.contentPiece.findMany({
      where: { scheduledDate: { gte: dayStart, lte: dayEnd } },
      include: { client: { select: { id: true, name: true, color: true } } },
      orderBy: [{ scheduledTime: 'asc' }, { createdAt: 'asc' }],
    }),

    // Manual work blocks for this user today
    prisma.workBlock.findMany({
      where: { userId, date: { gte: dayStart, lte: dayEnd } },
      orderBy: { startTime: 'asc' },
    }),
  ])

  res.json({ tasks, shoots, contentPieces, workBlocks })
})

// ── POST /blocks — create work block ─────────────────────────────────────────
dayplanRouter.post('/blocks', isAuth, async (req, res) => {
  const userId = req.user!.userId
  const { date, startTime, endTime, title, notes, color, taskId, shootId, contentPieceId, briefId } = req.body

  if (!date || !startTime || !endTime) {
    res.status(400).json({ error: 'date, startTime y endTime son requeridos' }); return
  }

  const block = await prisma.workBlock.create({
    data: {
      userId,
      date:          new Date(date + 'T12:00:00.000Z'),
      startTime,
      endTime,
      title:         title         || null,
      notes:         notes         || null,
      color:         color         || null,
      taskId:        taskId        || null,
      shootId:       shootId       || null,
      contentPieceId: contentPieceId || null,
      briefId:       briefId       || null,
    },
  })
  res.status(201).json(block)
})

// ── PATCH /blocks/:id — update work block ────────────────────────────────────
dayplanRouter.patch('/blocks/:id', isAuth, async (req, res) => {
  const userId = req.user!.userId
  const existing = await prisma.workBlock.findUnique({ where: { id: req.params.id } })
  if (!existing || existing.userId !== userId) {
    res.status(404).json({ error: 'Bloque no encontrado' }); return
  }

  const { startTime, endTime, title, notes, color, taskId, shootId, contentPieceId, briefId } = req.body
  const data: Record<string, unknown> = {}
  if (startTime !== undefined)      data.startTime      = startTime
  if (endTime !== undefined)        data.endTime        = endTime
  if (title !== undefined)          data.title          = title
  if (notes !== undefined)          data.notes          = notes
  if (color !== undefined)          data.color          = color
  if (taskId !== undefined)         data.taskId         = taskId || null
  if (shootId !== undefined)        data.shootId        = shootId || null
  if (contentPieceId !== undefined) data.contentPieceId = contentPieceId || null
  if (briefId !== undefined)        data.briefId        = briefId || null

  const block = await prisma.workBlock.update({ where: { id: req.params.id }, data })
  res.json(block)
})

// ── DELETE /blocks/:id — delete work block ───────────────────────────────────
dayplanRouter.delete('/blocks/:id', isAuth, async (req, res) => {
  const userId = req.user!.userId
  const existing = await prisma.workBlock.findUnique({ where: { id: req.params.id } })
  if (!existing || existing.userId !== userId) {
    res.status(404).json({ error: 'Bloque no encontrado' }); return
  }
  await prisma.workBlock.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

// ── PATCH /tasks/:id/status — change task status (bidirectional) ─────────────
dayplanRouter.patch('/tasks/:id/status', isAuth, async (req, res) => {
  const { status } = req.body as { status: TaskStatus }
  if (!['PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'BLOCKED'].includes(status)) {
    res.status(400).json({ error: 'Estado inválido' }); return
  }
  const task = await prisma.task.update({
    where: { id: req.params.id },
    data:  {
      status,
      completedAt: status === 'COMPLETED' ? new Date() : null,
    },
    select: { id: true, status: true, completedAt: true },
  })
  res.json(task)
})
