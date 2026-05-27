import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth } from '../middleware/auth'

export const timeRouter = Router()
timeRouter.use(isAuth)

const ENTRY_SELECT = {
  id: true,
  description: true,
  minutes: true,
  date: true,
  startedAt: true,
  createdAt: true,
  taskId: true,
  projectId: true,
  task: { select: { id: true, title: true, project: { select: { name: true } } } },
  project: { select: { id: true, name: true, client: { select: { name: true } } } },
}

// GET /api/time — list entries for current user
timeRouter.get('/', async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const { startDate, endDate, taskId, projectId } = req.query as Record<string, string>

  const where: Record<string, unknown> = { userId }
  if (startDate) where.date = { ...(where.date as object ?? {}), gte: new Date(startDate) }
  if (endDate)   where.date = { ...(where.date as object ?? {}), lte: new Date(endDate) }
  if (taskId)    where.taskId = taskId
  if (projectId) where.projectId = projectId

  const entries = await prisma.timeEntry.findMany({
    where,
    select: ENTRY_SELECT,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  })
  res.json(entries)
})

// POST /api/time — create manual entry
timeRouter.post('/', async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const { taskId, projectId, description, minutes, date } = req.body

  if (!minutes || !date) return res.status(400).json({ error: 'minutes and date are required' })

  const entry = await prisma.timeEntry.create({
    data: {
      userId,
      taskId:      taskId || null,
      projectId:   projectId || null,
      description: description || null,
      minutes:     Number(minutes),
      date:        new Date(date),
    },
    select: ENTRY_SELECT,
  })
  res.status(201).json(entry)
})

// PATCH /api/time/:id — edit own entry
timeRouter.patch('/:id', async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const { description, minutes, date, taskId, projectId } = req.body

  const existing = await prisma.timeEntry.findFirst({ where: { id: req.params.id, userId } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (existing.startedAt) return res.status(400).json({ error: 'Cannot edit an active timer entry' })

  const data: Record<string, unknown> = {}
  if (description !== undefined) data.description = description || null
  if (minutes !== undefined)     data.minutes = Number(minutes)
  if (date !== undefined)        data.date = new Date(date)
  if (taskId !== undefined)      data.taskId = taskId || null
  if (projectId !== undefined)   data.projectId = projectId || null

  const entry = await prisma.timeEntry.update({ where: { id: req.params.id }, data, select: ENTRY_SELECT })
  res.json(entry)
})

// DELETE /api/time/:id — delete own entry
timeRouter.delete('/:id', async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const existing = await prisma.timeEntry.findFirst({ where: { id: req.params.id, userId } })
  if (!existing) return res.status(404).json({ error: 'Not found' })

  await prisma.timeEntry.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

// ── Timer ──────────────────────────────────────────────────────────────────────

// GET /api/time/timer/active
timeRouter.get('/timer/active', async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const entry = await prisma.timeEntry.findFirst({
    where: { userId, startedAt: { not: null } },
    select: ENTRY_SELECT,
  })
  if (!entry) return res.json(null)

  const minutesElapsed = Math.floor((Date.now() - new Date(entry.startedAt!).getTime()) / 60000)
  res.json({ ...entry, minutesElapsed })
})

// POST /api/time/timer/start
timeRouter.post('/timer/start', async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const { taskId, projectId, description } = req.body

  const active = await prisma.timeEntry.findFirst({ where: { userId, startedAt: { not: null } } })
  if (active) return res.status(409).json({ error: 'Already have an active timer' })

  const now = new Date()
  const entry = await prisma.timeEntry.create({
    data: {
      userId,
      taskId:      taskId    || null,
      projectId:   projectId || null,
      description: description || null,
      minutes:     0,
      date:        now,
      startedAt:   now,
    },
    select: ENTRY_SELECT,
  })
  res.status(201).json({ ...entry, minutesElapsed: 0 })
})

// POST /api/time/timer/stop
timeRouter.post('/timer/stop', async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const active = await prisma.timeEntry.findFirst({ where: { userId, startedAt: { not: null } } })
  if (!active) return res.status(404).json({ error: 'No active timer' })

  const minutes = Math.max(1, Math.round((Date.now() - new Date(active.startedAt!).getTime()) / 60000))
  const entry = await prisma.timeEntry.update({
    where: { id: active.id },
    data:  { minutes, startedAt: null },
    select: ENTRY_SELECT,
  })
  res.json(entry)
})

// DELETE /api/time/timer/discard
timeRouter.delete('/timer/discard', async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const active = await prisma.timeEntry.findFirst({ where: { userId, startedAt: { not: null } } })
  if (!active) return res.status(404).json({ error: 'No active timer' })

  await prisma.timeEntry.delete({ where: { id: active.id } })
  res.json({ ok: true })
})
