import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdminOrLead, isAdmin } from '../middleware/auth'
import { createNotifications } from '../lib/notify'
import { getOrgId } from '../lib/orgContext'

export const shootsRouter = Router()
shootsRouter.use(isAuth)

const SHOOT_LIST_SELECT = {
  id: true, title: true, status: true, shootDate: true, endDate: true, notes: true, createdAt: true,
  location: { select: { id: true, name: true, address: true } },
  project:  { select: { id: true, name: true } },
  client:   { select: { id: true, name: true } },
  brief:    { select: { id: true, title: true } },
  _count:   { select: { crew: true, gear: true, vehicles: true } },
}

const SHOOT_DETAIL_SELECT = {
  id: true, title: true, status: true, shootDate: true, endDate: true, notes: true, createdAt: true, updatedAt: true,
  location: { select: { id: true, name: true, address: true, contactName: true, contactPhone: true, costPerDay: true } },
  project:  { select: { id: true, name: true } },
  client:   { select: { id: true, name: true } },
  brief:    { select: { id: true, title: true } },
  createdBy: { select: { id: true, name: true } },
  crew: {
    select: {
      id: true, role: true, callTime: true,
      user: { select: { id: true, name: true, avatarUrl: true, area: true } },
    },
    orderBy: { role: 'asc' },
  },
  gear: {
    select: {
      id: true, notes: true,
      gearItem: { select: { id: true, name: true, category: true, brand: true, model: true, serialNumber: true, status: true } },
    },
  },
  vehicles: {
    select: {
      id: true, driverName: true, notes: true,
      vehicle: { select: { id: true, name: true, plate: true, type: true, brand: true, model: true, color: true } },
    },
  },
}

// GET /api/shoots
shootsRouter.get('/', async (req: Request, res: Response) => {
  const user = req.user!
  const { status, from, to, projectId, clientId, briefId } = req.query as Record<string, string>
  const where: Record<string, unknown> = {}

  where.organizationId = getOrgId(req)
  // TEAM users only see shoots where they are in crew
  if (user.role === 'TEAM') {
    where.crew = { some: { userId: user.userId } }
  }
  if (user.role === 'PARTNER') {
    where.client = { commercialPartner: true, archivedAt: null }
  } else {
    where.OR = [{ clientId: null }, { client: { archivedAt: null } }]
  }
  if (status)    where.status    = status
  if (projectId) where.projectId = projectId
  if (clientId)  where.clientId  = clientId
  if (briefId)   where.briefId   = briefId
  if (from || to) {
    where.shootDate = {}
    if (from) (where.shootDate as Record<string, unknown>).gte = new Date(from)
    if (to)   (where.shootDate as Record<string, unknown>).lte = new Date(to)
  }

  const shoots = await prisma.shoot.findMany({
    where,
    select: SHOOT_LIST_SELECT,
    orderBy: { shootDate: 'desc' },
    take: 100,
  })
  res.json(shoots)
})

// GET /api/shoots/:id
shootsRouter.get('/:id', async (req: Request, res: Response) => {
  const user = req.user!
  const shoot = await prisma.shoot.findFirst({ where: { id: req.params.id, organizationId: getOrgId(req) }, select: SHOOT_DETAIL_SELECT })
  if (!shoot) return res.status(404).json({ error: 'Not found' })
  // TEAM can only see shoots where they are crew
  if (user.role === 'TEAM') {
    const isCrew = shoot.crew.some(c => c.user.id === user.userId)
    if (!isCrew) return res.status(403).json({ error: 'No autorizado' })
  }
  res.json(shoot)
})

// POST /api/shoots
shootsRouter.post('/', isAdminOrLead, async (req: Request, res: Response) => {
  const { title, shootDate, endDate, locationId, projectId, clientId, briefId, notes, status } = req.body
  if (!title || !shootDate) return res.status(400).json({ error: 'title y shootDate son requeridos' })
  const shoot = await prisma.shoot.create({
    data: {
      title,
      shootDate:      new Date(shootDate),
      endDate:        endDate    ? new Date(endDate) : null,
      locationId:     locationId || null,
      projectId:      projectId  || null,
      clientId:       clientId   || null,
      briefId:        briefId    || null,
      notes:          notes      || null,
      status:         status     || 'DRAFT',
      createdById:    req.user!.userId,
      organizationId: getOrgId(req),
    },
    select: SHOOT_DETAIL_SELECT,
  })
  res.status(201).json(shoot)
})

// PATCH /api/shoots/:id
shootsRouter.patch('/:id', isAdminOrLead, async (req: Request, res: Response) => {
  const existing = await prisma.shoot.findFirst({ where: { id: req.params.id, organizationId: getOrgId(req) }, select: { id: true } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  const { title, shootDate, endDate, locationId, projectId, clientId, briefId, notes, status } = req.body
  const data: Record<string, unknown> = {}
  if (title !== undefined)      data.title      = title
  if (shootDate !== undefined)  data.shootDate  = new Date(shootDate)
  if (endDate !== undefined)    data.endDate    = endDate ? new Date(endDate) : null
  if (locationId !== undefined) data.locationId = locationId || null
  if (projectId !== undefined)  data.projectId  = projectId  || null
  if (clientId !== undefined)   data.clientId   = clientId   || null
  if (briefId !== undefined)    data.briefId    = briefId    || null
  if (notes !== undefined)      data.notes      = notes      || null
  if (status !== undefined)     data.status     = status
  const shoot = await prisma.shoot.update({ where: { id: req.params.id }, data, select: SHOOT_DETAIL_SELECT })
  res.json(shoot)
})

// DELETE /api/shoots/:id
shootsRouter.delete('/:id', isAdmin, async (req: Request, res: Response) => {
  const existing = await prisma.shoot.findFirst({ where: { id: req.params.id, organizationId: getOrgId(req) }, select: { id: true } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  await prisma.shoot.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

// PUT /api/shoots/:id/crew
shootsRouter.put('/:id/crew', isAdminOrLead, async (req: Request, res: Response) => {
  const { crew } = req.body as { crew: { userId: string; role: string; callTime?: string }[] }
  if (!Array.isArray(crew)) return res.status(400).json({ error: 'crew debe ser un array' })

  // Capture previous crew IDs to detect newly added members
  const previousCrew = await prisma.shootCrew.findMany({
    where: { shootId: req.params.id },
    select: { userId: true },
  })
  const previousIds = new Set(previousCrew.map(c => c.userId))

  await prisma.$transaction([
    prisma.shootCrew.deleteMany({ where: { shootId: req.params.id } }),
    ...crew.map(c => prisma.shootCrew.create({
      data: {
        shootId:  req.params.id,
        userId:   c.userId,
        role:     c.role || 'Crew',
        callTime: c.callTime ? new Date(c.callTime) : null,
      },
    })),
  ])

  const shoot = await prisma.shoot.findUnique({ where: { id: req.params.id }, select: SHOOT_DETAIL_SELECT })
  res.json(shoot)

  // Notify newly added crew members (don't notify those who were already in the crew)
  if (shoot) {
    const actorId = (req as any).user?.userId
    const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })
    const newMembers = crew.filter(c => !previousIds.has(c.userId) && c.userId !== actorId)
    if (newMembers.length) {
      createNotifications(newMembers.map(c => ({
        userId: c.userId,
        type:   'shoot_assigned',
        title:  `Asignado a rodaje: ${shoot.title}`,
        body:   `${(req as any).user?.name ?? 'Un admin'} te asignó como ${c.role || 'Crew'} · ${fmtDate(shoot.shootDate)}`,
        link:   `/logistica/rodajes/${shoot.id}`,
      }))).catch(console.error)
    }
  }
})

// PUT /api/shoots/:id/gear
shootsRouter.put('/:id/gear', isAdminOrLead, async (req: Request, res: Response) => {
  const { gear } = req.body as { gear: { gearItemId: string; notes?: string }[] }
  if (!Array.isArray(gear)) return res.status(400).json({ error: 'gear debe ser un array' })

  await prisma.$transaction(async tx => {
    await tx.shootGear.deleteMany({ where: { shootId: req.params.id } })
    for (const g of gear) {
      await tx.shootGear.create({ data: { shootId: req.params.id, gearItemId: g.gearItemId, notes: g.notes || null } })
    }
  })

  const shoot = await prisma.shoot.findUnique({ where: { id: req.params.id }, select: SHOOT_DETAIL_SELECT })
  res.json(shoot)
})

// PUT /api/shoots/:id/vehicles
shootsRouter.put('/:id/vehicles', isAdminOrLead, async (req: Request, res: Response) => {
  const { vehicles } = req.body as { vehicles: { vehicleId: string; driverName?: string; notes?: string }[] }
  if (!Array.isArray(vehicles)) return res.status(400).json({ error: 'vehicles debe ser un array' })

  await prisma.$transaction([
    prisma.shootVehicle.deleteMany({ where: { shootId: req.params.id } }),
    ...vehicles.map(v => prisma.shootVehicle.create({
      data: { shootId: req.params.id, vehicleId: v.vehicleId, driverName: v.driverName || null, notes: v.notes || null },
    })),
  ])

  const shoot = await prisma.shoot.findUnique({ where: { id: req.params.id }, select: SHOOT_DETAIL_SELECT })
  res.json(shoot)
})
