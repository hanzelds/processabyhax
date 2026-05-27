import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdminOrLead, isAdmin } from '../middleware/auth'

export const vehiclesRouter = Router()
vehiclesRouter.use(isAuth)

const VEHICLE_SELECT = {
  id: true, name: true, plate: true, type: true, brand: true, model: true,
  year: true, color: true, status: true, notes: true, imageUrl: true, createdAt: true,
}

// GET /api/vehicles
vehiclesRouter.get('/', async (req: Request, res: Response) => {
  const { status } = req.query as Record<string, string>
  const where: Record<string, unknown> = {}
  if (status) where.status = status
  const items = await prisma.vehicle.findMany({ where, select: VEHICLE_SELECT, orderBy: { name: 'asc' } })
  res.json(items)
})

// GET /api/vehicles/:id
vehiclesRouter.get('/:id', async (req: Request, res: Response) => {
  const item = await prisma.vehicle.findUnique({ where: { id: req.params.id }, select: VEHICLE_SELECT })
  if (!item) return res.status(404).json({ error: 'Not found' })
  res.json(item)
})

// POST /api/vehicles
vehiclesRouter.post('/', isAdminOrLead, async (req: Request, res: Response) => {
  const { name, plate, type, brand, model, year, color, status, notes, imageUrl } = req.body
  if (!name || !plate || !type) return res.status(400).json({ error: 'name, plate y type son requeridos' })
  const item = await prisma.vehicle.create({
    data: { name, plate, type, brand: brand || null, model: model || null, year: year ? Number(year) : null, color: color || null, status: status || 'AVAILABLE', notes: notes || null, imageUrl: imageUrl || null },
    select: VEHICLE_SELECT,
  })
  res.status(201).json(item)
})

// PATCH /api/vehicles/:id
vehiclesRouter.patch('/:id', isAdminOrLead, async (req: Request, res: Response) => {
  const existing = await prisma.vehicle.findUnique({ where: { id: req.params.id }, select: { id: true } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  const { name, plate, type, brand, model, year, color, status, notes, imageUrl } = req.body
  const data: Record<string, unknown> = {}
  if (name !== undefined)     data.name     = name
  if (plate !== undefined)    data.plate    = plate
  if (type !== undefined)     data.type     = type
  if (brand !== undefined)    data.brand    = brand || null
  if (model !== undefined)    data.model    = model || null
  if (year !== undefined)     data.year     = year ? Number(year) : null
  if (color !== undefined)    data.color    = color || null
  if (status !== undefined)   data.status   = status
  if (notes !== undefined)    data.notes    = notes || null
  if (imageUrl !== undefined) data.imageUrl = imageUrl || null
  const item = await prisma.vehicle.update({ where: { id: req.params.id }, data, select: VEHICLE_SELECT })
  res.json(item)
})

// DELETE /api/vehicles/:id
vehiclesRouter.delete('/:id', isAdmin, async (req: Request, res: Response) => {
  const active = await prisma.shootVehicle.findFirst({ where: { vehicleId: req.params.id, shoot: { status: { in: ['DRAFT', 'CONFIRMED', 'IN_PROGRESS'] } } } })
  if (active) return res.status(409).json({ error: 'Este vehículo está asignado a rodajes activos' })
  await prisma.vehicle.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})
