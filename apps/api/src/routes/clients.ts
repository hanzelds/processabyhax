import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdmin, isAdminOrLead, requirePermission } from '../middleware/auth'
import { ClientStatus, ClientTier } from '@prisma/client'
import { logActivity } from '../lib/activityLogger'
import { logClientHistory, relativeTime } from '../lib/clientHistory'

export const clientsRouter = Router()

// ── helpers ──────────────────────────────────────────────────────────────────

async function clientMetricsInline(clientId: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [activeProjects, totalProjects] = await Promise.all([
    prisma.project.count({ where: { clientId, status: { in: ['ACTIVE', 'IN_PROGRESS'] } } }),
    prisma.project.count({ where: { clientId } }),
  ])
  return { activeProjects, totalProjects }
}

// ── GET /clients (enriched list) ─────────────────────────────────────────────

clientsRouter.get('/', requirePermission('clients.read'), async (_req, res) => {
  const clients = await prisma.client.findMany({
    orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { projects: true } },
      tags: { include: { tag: true } },
      contacts: { where: { isPrimary: true }, take: 1 },
    },
  })

  const enriched = await Promise.all(clients.map(async c => {
    const { activeProjects, totalProjects } = await clientMetricsInline(c.id)
    return {
      ...c,
      activeProjects,
      totalProjects,
      tags: c.tags.map(ct => ct.tag),
      primaryContact: c.contacts[0] ?? null,
    }
  }))

  res.json(enriched)
})

// ── GET /clients/:id ──────────────────────────────────────────────────────────

clientsRouter.get('/:id', requirePermission('clients.read'), async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: {
      projects: { orderBy: { createdAt: 'desc' }, include: { _count: { select: { tasks: true } } } },
      contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      tags: { include: { tag: true } },
    },
  })
  if (!client) { res.status(404).json({ error: 'Cliente no encontrado' }); return }
  res.json({ ...client, tags: client.tags.map(ct => ct.tag) })
})

// ── GET /clients/:id/metrics ──────────────────────────────────────────────────

clientsRouter.get('/:id/metrics', requirePermission('clients.read'), async (req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const clientId = req.params.id

  const projects = await prisma.project.findMany({ where: { clientId }, select: { id: true, status: true, createdAt: true, closedAt: true } })
  const projectIds = projects.map(p => p.id)
  const activeProjectIds = projects.filter(p => p.status !== 'COMPLETED').map(p => p.id)

  const [completedTasks, overdueTasks, teamMembers, lastProject] = await Promise.all([
    prisma.task.count({ where: { projectId: { in: projectIds }, status: 'COMPLETED' } }),
    prisma.task.count({ where: { projectId: { in: activeProjectIds }, status: { not: 'COMPLETED' }, dueDate: { lt: today } } }),
    prisma.task.findMany({ where: { projectId: { in: projectIds }, assignedTo: { not: null } }, distinct: ['assignedTo'], select: { assignedTo: true, assignee: { select: { area: true } } } }),
    prisma.project.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ])

  // Top area calculation
  const areaCounts: Record<string, number> = {}
  teamMembers.forEach(t => {
    const area = t.assignee?.area ?? 'Sin área'
    areaCounts[area] = (areaCounts[area] ?? 0) + 1
  })
  const topArea = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  // Tasks by month (last 6)
  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5); sixMonthsAgo.setDate(1); sixMonthsAgo.setHours(0, 0, 0, 0)
  const completedByMonth = await prisma.task.findMany({
    where: { projectId: { in: projectIds }, status: 'COMPLETED', updatedAt: { gte: sixMonthsAgo } },
    select: { updatedAt: true },
  })
  const monthMap: Record<string, number> = {}
  for (let i = 0; i < 6; i++) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap[key] = 0
  }
  completedByMonth.forEach(t => {
    const key = `${t.updatedAt.getFullYear()}-${String(t.updatedAt.getMonth() + 1).padStart(2, '0')}`
    if (key in monthMap) monthMap[key]++
  })
  const tasksByMonth = Object.entries(monthMap).sort().map(([month, completed]) => ({ month, completed }))

  // Projects by status
  const byStatus: Record<string, number> = {}
  projects.forEach(p => { byStatus[p.status] = (byStatus[p.status] ?? 0) + 1 })

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { relationStart: true } })
  const monthsAsClient = client?.relationStart
    ? Math.floor((Date.now() - new Date(client.relationStart).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    : null

  res.json({
    totalProjects: projects.length,
    activeProjects: activeProjectIds.length,
    completedTasksTotal: completedTasks,
    overdueTasksActive: overdueTasks,
    monthsAsClient,
    lastProjectDate: lastProject?.createdAt ?? null,
    teamMembersInvolved: teamMembers.length,
    topArea,
    tasksByMonth,
    projectsByStatus: byStatus,
  })
})

// ── POST /clients ─────────────────────────────────────────────────────────────

clientsRouter.post('/', isAdmin, async (req, res) => {
  const { name, contactName, contactInfo, industry, tier, website, description, relationStart } = req.body
  if (!name || !contactName || !contactInfo) {
    res.status(400).json({ error: 'Nombre, contacto y dato de contacto son requeridos' }); return
  }
  const client = await prisma.client.create({
    data: {
      name, contactName, contactInfo,
      industry: industry || null,
      tier: (tier as ClientTier) || 'REGULAR',
      website: website || null,
      description: description || null,
      relationStart: relationStart ? new Date(relationStart) : null,
    },
  })
  await Promise.all([
    logActivity({ actorId: req.user!.userId, eventType: 'client_created', entityType: 'client', entityId: client.id, entityName: client.name }),
    logClientHistory({ clientId: client.id, actorId: req.user!.userId, eventType: 'client_created', description: `Cliente "${client.name}" creado por ${req.user!.name ?? 'Admin'}` }),
  ])
  res.status(201).json(client)
})

// ── PATCH /clients/:id ────────────────────────────────────────────────────────

clientsRouter.patch('/:id', isAdmin, async (req, res) => {
  const { name, contactName, contactInfo, status, industry, tier, website, description, relationStart } = req.body
  const prev = await prisma.client.findUnique({ where: { id: req.params.id } })
  if (!prev) { res.status(404).json({ error: 'Cliente no encontrado' }); return }

  const data: Record<string, unknown> = {}
  if (name)              data.name = name
  if (contactName)       data.contactName = contactName
  if (contactInfo)       data.contactInfo = contactInfo
  if (status)            data.status = status as ClientStatus
  if (tier)              data.tier = tier as ClientTier
  if (industry !== undefined) data.industry = industry || null
  if (website !== undefined)  data.website = website || null
  if (description !== undefined) data.description = description || null
  if (relationStart !== undefined) data.relationStart = relationStart ? new Date(relationStart) : null

  const client = await prisma.client.update({ where: { id: req.params.id }, data })

  const histories: Promise<void>[] = []
  if (status && status !== prev.status) {
    histories.push(logActivity({ actorId: req.user!.userId, eventType: 'client_status_changed', entityType: 'client', entityId: client.id, entityName: client.name, meta: { from_status: prev.status, to_status: status } }))
    histories.push(logClientHistory({ clientId: client.id, actorId: req.user!.userId, eventType: 'status_changed', description: `Estado cambiado de ${prev.status} a ${status}`, meta: { from_status: prev.status, to_status: status } }))
  }
  if (tier && tier !== prev.tier) {
    histories.push(logClientHistory({ clientId: client.id, actorId: req.user!.userId, eventType: 'tier_changed', description: `Tier cambiado a ${tier}`, meta: { from_tier: prev.tier, to_tier: tier } }))
  }
  await Promise.all(histories)
  res.json(client)
})

// ── CONTACTS ──────────────────────────────────────────────────────────────────

clientsRouter.get('/:id/contacts', requirePermission('clients.read'), async (req, res) => {
  const contacts = await prisma.clientContact.findMany({
    where: { clientId: req.params.id },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  })
  res.json(contacts)
})

clientsRouter.post('/:id/contacts', isAdmin, async (req, res) => {
  const { name, role, email, phone, isPrimary, notes } = req.body
  if (!name || (!email && !phone)) { res.status(400).json({ error: 'Nombre y al menos un método de contacto son requeridos' }); return }

  if (isPrimary) {
    await prisma.clientContact.updateMany({ where: { clientId: req.params.id, isPrimary: true }, data: { isPrimary: false } })
  }
  const contact = await prisma.clientContact.create({ data: { clientId: req.params.id, name, role, email, phone, isPrimary: !!isPrimary, notes } })
  await logClientHistory({ clientId: req.params.id, actorId: req.user!.userId, eventType: 'contact_added', description: `Contacto "${name}" agregado${isPrimary ? ' como principal' : ''}`, meta: { contactId: contact.id, isPrimary: !!isPrimary } })
  res.status(201).json(contact)
})

clientsRouter.put('/:id/contacts/:contactId', isAdmin, async (req, res) => {
  const { name, role, email, phone, notes } = req.body
  const contact = await prisma.clientContact.update({
    where: { id: req.params.contactId },
    data: { name, role: role ?? null, email: email ?? null, phone: phone ?? null, notes: notes ?? null },
  })
  res.json(contact)
})

clientsRouter.patch('/:id/contacts/:contactId/set-primary', isAdmin, async (req, res) => {
  await prisma.clientContact.updateMany({ where: { clientId: req.params.id, isPrimary: true }, data: { isPrimary: false } })
  const contact = await prisma.clientContact.update({ where: { id: req.params.contactId }, data: { isPrimary: true } })
  await logClientHistory({ clientId: req.params.id, actorId: req.user!.userId, eventType: 'contact_set_primary', description: `"${contact.name}" marcado como contacto principal`, meta: { contactId: contact.id } })
  res.json(contact)
})

clientsRouter.delete('/:id/contacts/:contactId', isAdmin, async (req, res) => {
  const contact = await prisma.clientContact.findFirst({ where: { id: req.params.contactId, clientId: req.params.id } })
  if (!contact) { res.status(404).json({ error: 'Contacto no encontrado' }); return }
  await prisma.clientContact.delete({ where: { id: req.params.contactId } })
  await logClientHistory({ clientId: req.params.id, actorId: req.user!.userId, eventType: 'contact_removed', description: `Contacto "${contact.name}" eliminado`, meta: { contactId: contact.id } })
  res.json({ ok: true })
})

// ── TAGS ──────────────────────────────────────────────────────────────────────

clientsRouter.get('/tags/all', requirePermission('clients.read'), async (_req, res) => {
  const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } })
  res.json(tags)
})

clientsRouter.post('/:id/tags', isAdminOrLead, async (req, res) => {
  const { name } = req.body
  if (!name?.trim()) { res.status(400).json({ error: 'Nombre del tag requerido' }); return }

  const count = await prisma.clientTag.count({ where: { clientId: req.params.id } })
  if (count >= 10) { res.status(400).json({ error: 'Límite de 10 etiquetas por cliente alcanzado' }); return }

  const tag = await prisma.tag.upsert({ where: { name: name.trim().toLowerCase() }, create: { name: name.trim().toLowerCase() }, update: {} })
  await prisma.clientTag.upsert({ where: { clientId_tagId: { clientId: req.params.id, tagId: tag.id } }, create: { clientId: req.params.id, tagId: tag.id }, update: {} })
  await logClientHistory({ clientId: req.params.id, actorId: req.user!.userId, eventType: 'tag_added', description: `Etiqueta "${tag.name}" agregada`, meta: { tagId: tag.id } })
  res.status(201).json(tag)
})

clientsRouter.delete('/:id/tags/:tagId', isAdmin, async (req, res) => {
  const ct = await prisma.clientTag.findUnique({ where: { clientId_tagId: { clientId: req.params.id, tagId: req.params.tagId } }, include: { tag: true } })
  if (!ct) { res.status(404).json({ error: 'Tag no encontrado' }); return }
  await prisma.clientTag.delete({ where: { clientId_tagId: { clientId: req.params.id, tagId: req.params.tagId } } })
  await logClientHistory({ clientId: req.params.id, actorId: req.user!.userId, eventType: 'tag_removed', description: `Etiqueta "${ct.tag.name}" removida`, meta: { tagId: req.params.tagId } })
  res.json({ ok: true })
})

// ── NOTES ─────────────────────────────────────────────────────────────────────

clientsRouter.get('/:id/notes', requirePermission('clients.read'), async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50)
  const offset = parseInt(req.query.offset as string) || 0

  const [pinned, regular, total] = await Promise.all([
    prisma.clientNote.findMany({ where: { clientId: req.params.id, isPinned: true }, include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.clientNote.findMany({ where: { clientId: req.params.id, isPinned: false }, include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
    prisma.clientNote.count({ where: { clientId: req.params.id, isPinned: false } }),
  ])

  res.json({ pinned, notes: regular, total, hasMore: offset + limit < total })
})

clientsRouter.post('/:id/notes', isAdminOrLead, async (req, res) => {
  const { content } = req.body
  if (!content?.trim()) { res.status(400).json({ error: 'Contenido requerido' }); return }
  const note = await prisma.clientNote.create({
    data: { clientId: req.params.id, authorId: req.user!.userId, content: content.trim() },
    include: { author: { select: { id: true, name: true } } },
  })
  res.status(201).json(note)
})

clientsRouter.put('/:id/notes/:noteId', isAdminOrLead, async (req, res) => {
  const note = await prisma.clientNote.findUnique({ where: { id: req.params.noteId } })
  if (!note) { res.status(404).json({ error: 'Nota no encontrada' }); return }
  if (req.user!.role !== 'ADMIN' && note.authorId !== req.user!.userId) { res.status(403).json({ error: 'Sin permiso' }); return }
  const updated = await prisma.clientNote.update({
    where: { id: req.params.noteId },
    data: { content: req.body.content },
    include: { author: { select: { id: true, name: true } } },
  })
  res.json(updated)
})

clientsRouter.patch('/:id/notes/:noteId/pin', isAdmin, async (req, res) => {
  const note = await prisma.clientNote.findUnique({ where: { id: req.params.noteId } })
  if (!note) { res.status(404).json({ error: 'Nota no encontrada' }); return }

  if (!note.isPinned) {
    const pinnedCount = await prisma.clientNote.count({ where: { clientId: req.params.id, isPinned: true } })
    if (pinnedCount >= 2) { res.status(400).json({ error: 'Máximo 2 notas fijadas. Desfija una primero.' }); return }
  }

  const updated = await prisma.clientNote.update({
    where: { id: req.params.noteId },
    data: { isPinned: !note.isPinned },
    include: { author: { select: { id: true, name: true } } },
  })
  res.json(updated)
})

clientsRouter.delete('/:id/notes/:noteId', isAdminOrLead, async (req, res) => {
  const note = await prisma.clientNote.findUnique({ where: { id: req.params.noteId } })
  if (!note) { res.status(404).json({ error: 'Nota no encontrada' }); return }
  if (req.user!.role !== 'ADMIN' && note.authorId !== req.user!.userId) { res.status(403).json({ error: 'Sin permiso' }); return }
  await prisma.clientNote.delete({ where: { id: req.params.noteId } })
  res.json({ ok: true })
})

// ── HISTORY ───────────────────────────────────────────────────────────────────

clientsRouter.get('/:id/history', requirePermission('clients.read'), async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
  const offset = parseInt(req.query.offset as string) || 0

  const [entries, total] = await Promise.all([
    prisma.clientHistory.findMany({
      where: { clientId: req.params.id },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.clientHistory.count({ where: { clientId: req.params.id } }),
  ])

  res.json({
    entries: entries.map(e => ({ ...e, relativeTime: relativeTime(e.createdAt) })),
    total,
    hasMore: offset + limit < total,
  })
})
