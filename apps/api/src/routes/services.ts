import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdmin } from '../middleware/auth'
import { getOrgId } from '../lib/orgContext'

const router = Router()

// GET /api/services — list catalog ordered by order
router.get('/', isAuth, async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      where: { organizationId: getOrgId(req) },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })
    res.json(services)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener servicios' })
  }
})

// POST /api/services — create (ADMIN only)
router.post('/', isAdmin, async (req, res) => {
  try {
    const { name, icon, color, order } = req.body
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' })

    const service = await prisma.service.create({
      data: { name, icon: icon || null, color: color || null, order: order ?? 0, organizationId: getOrgId(req) },
    })
    res.status(201).json(service)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear servicio' })
  }
})

// PATCH /api/services/:id — edit (ADMIN only)
router.patch('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { name, icon, color, order } = req.body

    const existing = await prisma.service.findFirst({ where: { id, organizationId: getOrgId(req) }, select: { id: true } })
    if (!existing) return res.status(404).json({ error: 'Not found' })

    const service = await prisma.service.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(icon !== undefined && { icon: icon || null }),
        ...(color !== undefined && { color: color || null }),
        ...(order !== undefined && { order }),
      },
    })
    res.json(service)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar servicio' })
  }
})

// DELETE /api/services/:id — delete (ADMIN only, guard: no client services)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const existing = await prisma.service.findFirst({ where: { id, organizationId: getOrgId(req) }, select: { id: true } })
    if (!existing) return res.status(404).json({ error: 'Not found' })

    const count = await prisma.clientService.count({ where: { serviceId: id } })
    if (count > 0) {
      return res.status(409).json({ error: 'Este servicio tiene suscripciones activas y no puede eliminarse' })
    }

    await prisma.service.delete({ where: { id } })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar servicio' })
  }
})

export { router as servicesRouter }
