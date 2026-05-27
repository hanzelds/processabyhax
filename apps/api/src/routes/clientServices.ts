import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdminOrLead, isAdmin } from '../middleware/auth'

const router = Router()

// GET /api/clients/:id/services
router.get('/:id/services', isAuth, async (req, res) => {
  try {
    const { id } = req.params
    const services = await prisma.clientService.findMany({
      where: { clientId: id },
      include: {
        service: true,
        _count: { select: { projects: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
    res.json(services)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener servicios del cliente' })
  }
})

// POST /api/clients/:id/services
router.post('/:id/services', isAdminOrLead, async (req, res) => {
  try {
    const { id } = req.params
    const { serviceId, name, status, startDate, endDate, notes } = req.body

    if (!serviceId) return res.status(400).json({ error: 'serviceId es requerido' })

    // Verify client exists
    const client = await prisma.client.findUnique({ where: { id } })
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' })

    // Verify service exists
    const service = await prisma.service.findUnique({ where: { id: serviceId } })
    if (!service) return res.status(404).json({ error: 'Servicio no encontrado' })

    const cs = await prisma.clientService.create({
      data: {
        clientId: id,
        serviceId,
        name: name || null,
        status: status || 'ACTIVE',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        notes: notes || null,
      },
      include: {
        service: true,
        _count: { select: { projects: true } },
      },
    })
    res.status(201).json(cs)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear suscripción de servicio' })
  }
})

// PATCH /api/clients/:id/services/:csId
router.patch('/:id/services/:csId', isAdminOrLead, async (req, res) => {
  try {
    const { csId } = req.params
    const { name, status, startDate, endDate, notes } = req.body

    const cs = await prisma.clientService.update({
      where: { id: csId },
      data: {
        ...(name !== undefined && { name: name || null }),
        ...(status !== undefined && { status }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(notes !== undefined && { notes: notes || null }),
      },
      include: {
        service: true,
        _count: { select: { projects: true } },
      },
    })
    res.json(cs)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar suscripción' })
  }
})

// DELETE /api/clients/:id/services/:csId (ADMIN only, guard: no projects)
router.delete('/:id/services/:csId', isAdmin, async (req, res) => {
  try {
    const { csId } = req.params

    const count = await prisma.project.count({ where: { clientServiceId: csId } })
    if (count > 0) {
      return res.status(409).json({ error: 'Este servicio tiene proyectos asociados y no puede eliminarse' })
    }

    await prisma.clientService.delete({ where: { id: csId } })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar suscripción' })
  }
})

export { router as clientServicesRouter }
