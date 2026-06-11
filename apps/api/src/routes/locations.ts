import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdminOrLead, isAdmin } from '../middleware/auth'
import { getOrgId } from '../lib/orgContext'

export const locationsRouter = Router()
locationsRouter.use(isAuth)

const LOCATION_SELECT = {
  id: true, name: true, address: true, contactName: true, contactPhone: true,
  contactEmail: true, costPerDay: true, notes: true, photoUrls: true,
  isActive: true, createdAt: true,
  _count: { select: { shoots: true } },
}

// GET /api/locations
locationsRouter.get('/', async (req: Request, res: Response) => {
  const { active } = req.query as Record<string, string>
  const where: Record<string, unknown> = {}
  if (active === 'true')  where.isActive = true
  if (active === 'false') where.isActive = false
  where.organizationId = getOrgId(req)
  const items = await prisma.location.findMany({ where, select: LOCATION_SELECT, orderBy: { name: 'asc' } })
  res.json(items)
})

// GET /api/locations/:id
locationsRouter.get('/:id', async (req: Request, res: Response) => {
  const item = await prisma.location.findFirst({
    where: { id: req.params.id, organizationId: getOrgId(req) },
    select: {
      ...LOCATION_SELECT,
      shoots: {
        select: { id: true, title: true, status: true, shootDate: true },
        orderBy: { shootDate: 'desc' },
        take: 20,
      },
    },
  })
  if (!item) return res.status(404).json({ error: 'Not found' })
  res.json(item)
})

// POST /api/locations
locationsRouter.post('/', isAdminOrLead, async (req: Request, res: Response) => {
  const { name, address, contactName, contactPhone, contactEmail, costPerDay, notes, photoUrls } = req.body
  if (!name) return res.status(400).json({ error: 'name es requerido' })
  const item = await prisma.location.create({
    data: {
      name,
      address:        address      || null,
      contactName:    contactName  || null,
      contactPhone:   contactPhone || null,
      contactEmail:   contactEmail || null,
      costPerDay:     costPerDay   != null ? Number(costPerDay) : null,
      notes:          notes        || null,
      photoUrls:      Array.isArray(photoUrls) ? photoUrls.filter(Boolean) : [],
      organizationId: getOrgId(req),
    },
    select: LOCATION_SELECT,
  })
  res.status(201).json(item)
})

// PATCH /api/locations/:id
locationsRouter.patch('/:id', isAdminOrLead, async (req: Request, res: Response) => {
  const existing = await prisma.location.findFirst({ where: { id: req.params.id, organizationId: getOrgId(req) }, select: { id: true } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  const { name, address, contactName, contactPhone, contactEmail, costPerDay, notes, photoUrls } = req.body
  const data: Record<string, unknown> = {}
  if (name !== undefined)         data.name         = name
  if (address !== undefined)      data.address      = address      || null
  if (contactName !== undefined)  data.contactName  = contactName  || null
  if (contactPhone !== undefined) data.contactPhone = contactPhone || null
  if (contactEmail !== undefined) data.contactEmail = contactEmail || null
  if (costPerDay !== undefined)   data.costPerDay   = costPerDay != null ? Number(costPerDay) : null
  if (notes !== undefined)        data.notes        = notes        || null
  if (photoUrls !== undefined)    data.photoUrls    = Array.isArray(photoUrls) ? photoUrls.filter(Boolean) : []
  const item = await prisma.location.update({ where: { id: req.params.id }, data, select: LOCATION_SELECT })
  res.json(item)
})

// DELETE /api/locations/:id — soft delete
locationsRouter.delete('/:id', isAdmin, async (req: Request, res: Response) => {
  const existing = await prisma.location.findFirst({ where: { id: req.params.id, organizationId: getOrgId(req) }, select: { id: true } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  const item = await prisma.location.update({ where: { id: req.params.id }, data: { isActive: false }, select: LOCATION_SELECT })
  res.json(item)
})
