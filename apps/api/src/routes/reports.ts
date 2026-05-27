import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdminOrLead } from '../middleware/auth'

export const reportsRouter = Router()
reportsRouter.use(isAuth, isAdminOrLead)

function parseDateRange(query: Record<string, string>) {
  const start = query.startDate ? new Date(query.startDate) : (() => {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d
  })()
  const end = query.endDate ? new Date(query.endDate) : new Date()
  return { start, end }
}

// GET /api/reports/hours-by-user
reportsRouter.get('/hours-by-user', async (req: Request, res: Response) => {
  const { start, end } = parseDateRange(req.query as Record<string, string>)
  const format = (req.query as Record<string, string>).format

  const entries = await prisma.timeEntry.findMany({
    where: { date: { gte: start, lte: end }, startedAt: null },
    select: { userId: true, minutes: true, taskId: true, task: { select: { completedAt: true, dueDate: true } } },
  })

  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, area: true, role: true },
  })

  // count completed tasks per user in range
  const completedTasks = await prisma.task.findMany({
    where: { completedAt: { gte: start, lte: end }, assignees: { some: {} } },
    select: { completedAt: true, dueDate: true, assignees: { select: { userId: true } } },
  })

  const userMap = new Map(users.map(u => [u.id, { ...u, totalMinutes: 0, tasksCompleted: 0, onTimeCount: 0 }]))

  for (const e of entries) {
    const u = userMap.get(e.userId)
    if (u) u.totalMinutes += e.minutes
  }

  for (const t of completedTasks) {
    for (const a of t.assignees) {
      const u = userMap.get(a.userId)
      if (!u) continue
      u.tasksCompleted++
      if (!t.dueDate || (t.completedAt && t.completedAt <= t.dueDate)) u.onTimeCount++
    }
  }

  const rows = [...userMap.values()].map(u => ({
    userId:        u.id,
    name:          u.name,
    area:          u.area,
    role:          u.role,
    totalMinutes:  u.totalMinutes,
    totalHours:    +(u.totalMinutes / 60).toFixed(1),
    tasksCompleted: u.tasksCompleted,
    onTimePct:     u.tasksCompleted > 0 ? Math.round((u.onTimeCount / u.tasksCompleted) * 100) : null,
  })).sort((a, b) => b.totalMinutes - a.totalMinutes)

  if (format === 'csv') {
    const header = 'Nombre,Área,Rol,Horas registradas,Tareas completadas,% On-time\n'
    const lines = rows.map(r =>
      `"${r.name}","${r.area ?? ''}","${r.role}",${r.totalHours},${r.tasksCompleted},${r.onTimePct ?? ''}`
    ).join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="horas-por-persona.csv"')
    return res.send(header + lines)
  }

  res.json(rows)
})

// GET /api/reports/hours-by-project
reportsRouter.get('/hours-by-project', async (req: Request, res: Response) => {
  const { start, end } = parseDateRange(req.query as Record<string, string>)

  const entries = await prisma.timeEntry.findMany({
    where: { date: { gte: start, lte: end }, startedAt: null, projectId: { not: null } },
    select: { minutes: true, projectId: true, project: { select: { id: true, name: true, client: { select: { id: true, name: true } } } } },
  })

  // group by client → project
  const clientMap = new Map<string, { clientId: string; clientName: string; totalMinutes: number; projects: Map<string, { projectId: string; projectName: string; totalMinutes: number }> }>()

  for (const e of entries) {
    if (!e.project) continue
    const c = e.project.client
    if (!clientMap.has(c.id)) clientMap.set(c.id, { clientId: c.id, clientName: c.name, totalMinutes: 0, projects: new Map() })
    const clientData = clientMap.get(c.id)!
    clientData.totalMinutes += e.minutes
    if (!clientData.projects.has(e.project.id)) clientData.projects.set(e.project.id, { projectId: e.project.id, projectName: e.project.name, totalMinutes: 0 })
    clientData.projects.get(e.project.id)!.totalMinutes += e.minutes
  }

  const result = [...clientMap.values()].map(c => ({
    clientId:    c.clientId,
    clientName:  c.clientName,
    totalHours:  +(c.totalMinutes / 60).toFixed(1),
    projects: [...c.projects.values()].map(p => ({
      projectId:   p.projectId,
      projectName: p.projectName,
      totalHours:  +(p.totalMinutes / 60).toFixed(1),
    })).sort((a, b) => b.totalHours - a.totalHours),
  })).sort((a, b) => b.totalHours - a.totalHours)

  res.json(result)
})

// GET /api/reports/weekly
reportsRouter.get('/weekly', async (req: Request, res: Response) => {
  const weeks = Math.min(52, Math.max(1, Number((req.query as Record<string, string>).weeks) || 8))

  const now = new Date()
  // Get start of current week (Monday)
  const currentMonday = new Date(now)
  const day = currentMonday.getDay()
  currentMonday.setDate(currentMonday.getDate() - (day === 0 ? 6 : day - 1))
  currentMonday.setHours(0, 0, 0, 0)

  const results = []
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = new Date(currentMonday)
    weekStart.setDate(weekStart.getDate() - w * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const [entries, completedTasks] = await Promise.all([
      prisma.timeEntry.aggregate({
        where: { date: { gte: weekStart, lte: weekEnd }, startedAt: null },
        _sum: { minutes: true },
        _count: { _all: true },
      }),
      prisma.task.count({ where: { completedAt: { gte: weekStart, lte: weekEnd } } }),
    ])

    const activeUsers = await prisma.timeEntry.findMany({
      where: { date: { gte: weekStart, lte: weekEnd }, startedAt: null },
      distinct: ['userId'],
      select: { userId: true },
    })

    const totalMinutes = entries._sum.minutes ?? 0
    const activeCount  = activeUsers.length
    results.push({
      weekStart:      weekStart.toISOString().split('T')[0],
      weekEnd:        weekEnd.toISOString().split('T')[0],
      totalHours:     +(totalMinutes / 60).toFixed(1),
      tasksCompleted: completedTasks,
      avgHoursPerPerson: activeCount > 0 ? +(totalMinutes / 60 / activeCount).toFixed(1) : 0,
    })
  }

  res.json(results)
})

// GET /api/reports/user/:userId
reportsRouter.get('/user/:userId', async (req: Request, res: Response) => {
  const { start, end } = parseDateRange(req.query as Record<string, string>)

  const user = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { id: true, name: true, area: true, role: true } })
  if (!user) return res.status(404).json({ error: 'User not found' })

  const entries = await prisma.timeEntry.findMany({
    where: { userId: req.params.userId, date: { gte: start, lte: end }, startedAt: null },
    select: { minutes: true, date: true, projectId: true, project: { select: { id: true, name: true, client: { select: { name: true } } } } },
    orderBy: { date: 'desc' },
  })

  // hours by week
  const weekMap = new Map<string, number>()
  for (const e of entries) {
    const d = new Date(e.date)
    const day = d.getDay()
    const monday = new Date(d)
    monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1))
    const key = monday.toISOString().split('T')[0]
    weekMap.set(key, (weekMap.get(key) ?? 0) + e.minutes)
  }
  const hoursByWeek = [...weekMap.entries()].map(([week, minutes]) => ({ week, hours: +(minutes / 60).toFixed(1) })).sort((a, b) => a.week.localeCompare(b.week))

  // hours by project
  const projectMap = new Map<string, { projectId: string; projectName: string; clientName: string; totalMinutes: number }>()
  for (const e of entries) {
    if (!e.project) continue
    if (!projectMap.has(e.project.id)) projectMap.set(e.project.id, { projectId: e.project.id, projectName: e.project.name, clientName: e.project.client.name, totalMinutes: 0 })
    projectMap.get(e.project.id)!.totalMinutes += e.minutes
  }
  const hoursByProject = [...projectMap.values()].map(p => ({ ...p, totalHours: +(p.totalMinutes / 60).toFixed(1) })).sort((a, b) => b.totalHours - a.totalHours)

  res.json({ user, hoursByWeek, hoursByProject, totalHours: +(entries.reduce((s, e) => s + e.minutes, 0) / 60).toFixed(1) })
})
