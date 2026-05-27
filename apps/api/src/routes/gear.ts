import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdminOrLead, isAdmin } from '../middleware/auth'

export const gearRouter = Router()
gearRouter.use(isAuth)

const GEAR_SELECT = {
  id: true, name: true, category: true, brand: true, model: true,
  serialNumber: true, status: true, notes: true, imageUrl: true, createdAt: true,
  _count: { select: { shootGear: true } },
}

// GET /api/gear
gearRouter.get('/', async (req: Request, res: Response) => {
  const { category, status } = req.query as Record<string, string>
  const where: Record<string, unknown> = {}
  if (category) where.category = category
  if (status)   where.status   = status
  const items = await prisma.gearItem.findMany({ where, select: GEAR_SELECT, orderBy: [{ category: 'asc' }, { name: 'asc' }] })
  res.json(items)
})

// GET /api/gear/:id
gearRouter.get('/:id', async (req: Request, res: Response) => {
  const item = await prisma.gearItem.findUnique({ where: { id: req.params.id }, select: GEAR_SELECT })
  if (!item) return res.status(404).json({ error: 'Not found' })
  res.json(item)
})

// POST /api/gear
gearRouter.post('/', isAdminOrLead, async (req: Request, res: Response) => {
  const { name, category, brand, model, serialNumber, status, notes, imageUrl } = req.body
  if (!name || !category) return res.status(400).json({ error: 'name y category son requeridos' })
  const item = await prisma.gearItem.create({
    data: { name, category, brand: brand || null, model: model || null, serialNumber: serialNumber || null, status: status || 'AVAILABLE', notes: notes || null, imageUrl: imageUrl || null },
    select: GEAR_SELECT,
  })
  res.status(201).json(item)
})

// PATCH /api/gear/:id
gearRouter.patch('/:id', isAdminOrLead, async (req: Request, res: Response) => {
  const existing = await prisma.gearItem.findUnique({ where: { id: req.params.id }, select: { id: true } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  const { name, category, brand, model, serialNumber, status, notes, imageUrl } = req.body
  const data: Record<string, unknown> = {}
  if (name !== undefined)         data.name         = name
  if (category !== undefined)     data.category     = category
  if (brand !== undefined)        data.brand        = brand || null
  if (model !== undefined)        data.model        = model || null
  if (serialNumber !== undefined) data.serialNumber = serialNumber || null
  if (status !== undefined)       data.status       = status
  if (notes !== undefined)        data.notes        = notes || null
  if (imageUrl !== undefined)     data.imageUrl     = imageUrl || null
  const item = await prisma.gearItem.update({ where: { id: req.params.id }, data, select: GEAR_SELECT })
  res.json(item)
})

// DELETE /api/gear/:id
gearRouter.delete('/:id', isAdmin, async (req: Request, res: Response) => {
  const active = await prisma.shootGear.findFirst({ where: { gearItemId: req.params.id, shoot: { status: { in: ['DRAFT', 'CONFIRMED', 'IN_PROGRESS'] } } } })
  if (active) return res.status(409).json({ error: 'Este equipo está asignado a rodajes activos' })
  await prisma.gearItem.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})
