import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdminOrLead } from '../middleware/auth'
import { BriefStatus, BriefRole, ContentType } from '@prisma/client'
import { sendBriefAssignedEmail, sendBriefStatusEmail } from '../lib/email'

export const briefsRouter = Router()

const BRIEF_SELECT = {
  id: true, title: true, type: true, platforms: true, status: true,
  concept: true, script: true, referencesUrls: true, copyDraft: true,
  hashtags: true, technicalNotes: true, clientApprovalNotes: true,
  isRecurring: true, recurrenceFreq: true, createdAt: true, updatedAt: true,
  clientId: true,
  client: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  assignees: {
    include: { user: { select: { id: true, name: true, email: true, area: true, avatarUrl: true } } },
    orderBy: { assignedAt: 'asc' as const },
  },
}

async function logBriefHistory(briefId: string, actorId: string, eventType: string, description: string, meta?: object) {
  await prisma.briefHistory.create({ data: { briefId, actorId, eventType, description, meta } })
}

async function getLeadEmails() {
  const users = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'LEAD'] }, status: 'ACTIVE' },
    select: { email: true },
  })
  return users.map(u => u.email)
}

// ── GET / — list briefs ───────────────────────────────────────────────────────
briefsRouter.get('/', isAuth, async (req, res) => {
  const { clientId, type, status } = req.query
  const { user } = req

  const where: Record<string, unknown> = {}
  if (clientId) where.clientId = clientId as string
  if (type)     where.type     = type as ContentType
  if (status)   where.status   = status as BriefStatus

  // Team users only see briefs they're assigned to
  if (user!.role === 'TEAM') {
    where.assignees = { some: { userId: user!.userId } }
  }

  const briefs = await prisma.contentBrief.findMany({
    where,
    select: BRIEF_SELECT,
    orderBy: { updatedAt: 'desc' },
  })
  res.json(briefs)
})

// ── GET /:id ──────────────────────────────────────────────────────────────────
briefsRouter.get('/:id', isAuth, async (req, res) => {
  const brief = await prisma.contentBrief.findUnique({
    where: { id: req.params.id },
    select: { ...BRIEF_SELECT, history: { include: { actor: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } } },
  })
  if (!brief) { res.status(404).json({ error: 'Brief no encontrado' }); return }
  res.json(brief)
})

// ── POST / — create brief ─────────────────────────────────────────────────────
briefsRouter.post('/', isAdminOrLead, async (req, res) => {
  const { title, clientId, type, platforms, concept, script, referencesUrls,
          copyDraft, hashtags, technicalNotes, isRecurring, recurrenceFreq } = req.body

  if (!title || !clientId || !type || !platforms?.length) {
    res.status(400).json({ error: 'Título, cliente, tipo y plataforma son requeridos' }); return
  }

  const brief = await prisma.contentBrief.create({
    data: {
      title, clientId, type: type as ContentType,
      platforms: platforms as string[],
      concept, script, referencesUrls: referencesUrls ?? [],
      copyDraft, hashtags, technicalNotes,
      isRecurring: isRecurring ?? false,
      recurrenceFreq: recurrenceFreq || null,
      createdById: req.user!.userId,
    },
    select: BRIEF_SELECT,
  })

  await logBriefHistory(brief.id, req.user!.userId, 'brief_created',
    `Brief "${brief.title}" creado`)

  res.status(201).json(brief)
})

// ── PATCH /:id — edit brief ───────────────────────────────────────────────────
briefsRouter.patch('/:id', isAdminOrLead, async (req, res) => {
  const { title, concept, script, referencesUrls, copyDraft, hashtags,
          technicalNotes, clientApprovalNotes, isRecurring, recurrenceFreq, type, platforms } = req.body

  const data: Record<string, unknown> = {}
  if (title !== undefined)               data.title               = title
  if (type !== undefined)                data.type                = type
  if (platforms !== undefined)           data.platforms           = platforms
  if (concept !== undefined)             data.concept             = concept
  if (script !== undefined)              data.script              = script
  if (referencesUrls !== undefined)      data.referencesUrls      = referencesUrls
  if (copyDraft !== undefined)           data.copyDraft           = copyDraft
  if (hashtags !== undefined)            data.hashtags            = hashtags
  if (technicalNotes !== undefined)      data.technicalNotes      = technicalNotes
  if (clientApprovalNotes !== undefined) data.clientApprovalNotes = clientApprovalNotes
  if (isRecurring !== undefined)         data.isRecurring         = isRecurring
  if (recurrenceFreq !== undefined)      data.recurrenceFreq      = recurrenceFreq || null

  const brief = await prisma.contentBrief.update({
    where: { id: req.params.id },
    data,
    select: BRIEF_SELECT,
  })

  if (script !== undefined) {
    await logBriefHistory(brief.id, req.user!.userId, 'script_updated', 'Guión/estructura actualizado')
  }

  res.json(brief)
})

// ── PATCH /:id/status ─────────────────────────────────────────────────────────
briefsRouter.patch('/:id/status', isAdminOrLead, async (req, res) => {
  const { status } = req.body
  if (!status) { res.status(400).json({ error: 'Status requerido' }); return }

  const prev = await prisma.contentBrief.findUnique({
    where: { id: req.params.id },
    select: { status: true, title: true, isRecurring: true, clientId: true,
              type: true, platforms: true, concept: true, technicalNotes: true,
              recurrenceFreq: true, createdById: true,
              assignees: { include: { user: { select: { email: true, name: true } } } } },
  })
  if (!prev) { res.status(404).json({ error: 'Brief no encontrado' }); return }
  if (prev.status === 'entregado' || prev.status === 'cancelado') {
    res.status(400).json({ error: 'Este brief ya no puede cambiar de estado' }); return
  }

  const brief = await prisma.contentBrief.update({
    where: { id: req.params.id },
    data: { status: status as BriefStatus },
    select: BRIEF_SELECT,
  })

  await logBriefHistory(brief.id, req.user!.userId, 'status_changed',
    `Estado cambiado a ${status}`, { from: prev.status, to: status })

  // Auto-generate content piece when delivered
  if (status === 'entregado') {
    const existingPiece = await prisma.contentPiece.findFirst({ where: { briefId: brief.id } })
    if (!existingPiece) {
      await prisma.contentPiece.create({
        data: {
          briefId:    brief.id,
          clientId:   brief.clientId,
          title:      brief.title,
          type:       brief.type,
          platforms:  brief.platforms,
          copy:       brief.copyDraft ?? null,
          hashtags:   brief.hashtags ?? null,
          referencesUrls: brief.referencesUrls ?? [],
          status:     'listo',
          createdById: req.user!.userId,
        },
      })
      await logBriefHistory(brief.id, req.user!.userId, 'piece_generated',
        `Pieza de contenido generada automáticamente`)
    }

    // Clone for next recurrence
    if (prev.isRecurring && prev.recurrenceFreq) {
      const freqLabel: Record<string, string> = { semanal: '(siguiente semana)', quincenal: '(siguiente quincena)', mensual: '(siguiente mes)' }
      await prisma.contentBrief.create({
        data: {
          title:         `${prev.title} ${freqLabel[prev.recurrenceFreq] ?? ''}`.trim(),
          clientId:      prev.clientId,
          type:          prev.type,
          platforms:     prev.platforms,
          concept:       prev.concept ?? '',
          technicalNotes: prev.technicalNotes,
          isRecurring:   true,
          recurrenceFreq: prev.recurrenceFreq,
          status:        'idea',
          createdById:   prev.createdById,
          referencesUrls: [],
        },
      })
    }
  }

  // Send email notifications
  sendBriefStatusEmail({ brief, status, actor: req.user!.name ?? 'Un admin' })
    .catch(console.error)

  res.json(brief)
})

// ── POST /:id/assignees ───────────────────────────────────────────────────────
briefsRouter.post('/:id/assignees', isAdminOrLead, async (req, res) => {
  const { userId, role } = req.body
  if (!userId || !role) { res.status(400).json({ error: 'userId y role son requeridos' }); return }

  const [brief, user] = await Promise.all([
    prisma.contentBrief.findUnique({ where: { id: req.params.id }, select: { title: true, clientId: true, client: { select: { name: true } } } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
  ])
  if (!brief || !user) { res.status(404).json({ error: 'Brief o usuario no encontrado' }); return }

  const assignee = await prisma.briefAssignee.create({
    data: { briefId: req.params.id, userId, role: role as BriefRole, assignedById: req.user!.userId },
    include: { user: { select: { id: true, name: true, area: true, avatarUrl: true } } },
  })

  await logBriefHistory(req.params.id, req.user!.userId, 'assignee_added',
    `${user.name} asignado como ${role}`, { userId, role })

  sendBriefAssignedEmail({
    to: user.email,
    recipientName: user.name,
    assignerName: req.user!.name ?? 'Un admin',
    briefTitle: brief.title,
    role,
    clientName: brief.client.name,
  }).catch(console.error)

  res.status(201).json(assignee)
})

// ── DELETE /:id/assignees/:userId/:role ───────────────────────────────────────
briefsRouter.delete('/:id/assignees/:userId/:role', isAdminOrLead, async (req, res) => {
  const { id, userId, role } = req.params
  await prisma.briefAssignee.deleteMany({ where: { briefId: id, userId, role: role as BriefRole } })
  await logBriefHistory(id, req.user!.userId, 'assignee_removed',
    `Asignado removido del rol ${role}`, { userId, role })
  res.json({ ok: true })
})

// ── GET /:id/history ──────────────────────────────────────────────────────────
briefsRouter.get('/:id/history', isAuth, async (req, res) => {
  const history = await prisma.briefHistory.findMany({
    where: { briefId: req.params.id },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(history)
})
