import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdminOrLead } from '../middleware/auth'
import { ContentPieceStatus, CopyStatus, ContentType } from '@prisma/client'
import { sendPieceScheduledEmail, sendPiecePublishedEmail } from '../lib/email'

export const contentCalendarRouter = Router()

const PIECE_SELECT = {
  id: true, title: true, type: true, platforms: true, status: true,
  clientId: true,
  copy: true, hashtags: true, referencesUrls: true, copyStatus: true,
  publicationNotes: true, scheduledDate: true, scheduledTime: true,
  publishedAt: true, briefId: true, createdAt: true, updatedAt: true,
  client: { select: { id: true, name: true, color: true } },
  createdBy: { select: { id: true, name: true } },
  brief: { select: { id: true, title: true, status: true } },
}

async function logPieceHistory(pieceId: string, actorId: string, eventType: string, description: string, meta?: object) {
  await prisma.contentPieceHistory.create({ data: { pieceId, actorId, eventType, description, meta } })
}

async function getAdminLeadEmails() {
  const users = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'LEAD'] }, status: 'ACTIVE' },
    select: { email: true },
  })
  return users.map(u => u.email)
}

// ── GET /calendar — monthly view ──────────────────────────────────────────────
contentCalendarRouter.get('/calendar', isAdminOrLead, async (req, res) => {
  const year  = parseInt(req.query.year  as string) || new Date().getFullYear()
  const month = parseInt(req.query.month as string) || new Date().getMonth() + 1
  const { clientId } = req.query

  const start = new Date(year, month - 1, 1)
  const end   = new Date(year, month, 0, 23, 59, 59)

  const where: Record<string, unknown> = {
    scheduledDate: { gte: start, lte: end },
    status: { notIn: ['cancelado'] },
  }
  if (clientId) where.clientId = clientId as string

  const pieces = await prisma.contentPiece.findMany({
    where,
    select: PIECE_SELECT,
    orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
  })
  res.json(pieces)
})

// ── GET /inbox — unscheduled pieces ───────────────────────────────────────────
contentCalendarRouter.get('/inbox', isAdminOrLead, async (req, res) => {
  const { clientId } = req.query
  const where: Record<string, unknown> = {
    scheduledDate: null,
    status: { in: ['listo', 'en_revision'] },
  }
  if (clientId) where.clientId = clientId as string

  const pieces = await prisma.contentPiece.findMany({
    where,
    select: PIECE_SELECT,
    orderBy: { createdAt: 'desc' },
  })
  res.json(pieces)
})

// ── GET /pieces — list with filters ──────────────────────────────────────────
contentCalendarRouter.get('/pieces', isAdminOrLead, async (req, res) => {
  const { clientId, status, type, copyStatus } = req.query
  const where: Record<string, unknown> = {}
  if (clientId)  where.clientId  = clientId as string
  if (status)    where.status    = status as ContentPieceStatus
  if (type)      where.type      = type as ContentType
  if (copyStatus) where.copyStatus = copyStatus as CopyStatus

  const pieces = await prisma.contentPiece.findMany({
    where,
    select: PIECE_SELECT,
    orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'desc' }],
  })
  res.json(pieces)
})

// ── GET /pieces/:id ───────────────────────────────────────────────────────────
contentCalendarRouter.get('/pieces/:id', isAdminOrLead, async (req, res) => {
  const piece = await prisma.contentPiece.findUnique({
    where: { id: req.params.id },
    select: {
      ...PIECE_SELECT,
      history: { include: { actor: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
    },
  })
  if (!piece) { res.status(404).json({ error: 'Pieza no encontrada' }); return }
  res.json(piece)
})

// ── POST /pieces — create piece directly ──────────────────────────────────────
contentCalendarRouter.post('/pieces', isAdminOrLead, async (req, res) => {
  const { title, clientId, type, platforms, copy, hashtags, referencesUrls,
          copyStatus, publicationNotes, scheduledDate, scheduledTime } = req.body

  if (!title || !clientId || !type || !platforms?.length) {
    res.status(400).json({ error: 'Título, cliente, tipo y plataforma son requeridos' }); return
  }

  const piece = await prisma.contentPiece.create({
    data: {
      title, clientId, type: type as ContentType,
      platforms: platforms as string[],
      copy: copy || null,
      hashtags: hashtags || null,
      referencesUrls: referencesUrls ?? [],
      copyStatus: (copyStatus as CopyStatus) || 'pendiente',
      publicationNotes: publicationNotes || null,
      createdById: req.user!.userId,
      ...(scheduledDate ? {
        scheduledDate: new Date(scheduledDate),
        scheduledTime: scheduledTime || null,
        status: 'programado' as const,
      } : {}),
    },
    select: PIECE_SELECT,
  })

  await logPieceHistory(piece.id, req.user!.userId, 'piece_created', `Pieza "${piece.title}" creada`)

  res.status(201).json(piece)
})

// ── PATCH /pieces/:id — edit piece ────────────────────────────────────────────
contentCalendarRouter.patch('/pieces/:id', isAdminOrLead, async (req, res) => {
  const { title, copy, hashtags, referencesUrls, copyStatus, publicationNotes } = req.body
  const data: Record<string, unknown> = {}

  if (title !== undefined)            data.title            = title
  if (copy !== undefined)             data.copy             = copy
  if (hashtags !== undefined)         data.hashtags         = hashtags
  if (referencesUrls !== undefined)   data.referencesUrls   = referencesUrls
  if (copyStatus !== undefined)       data.copyStatus       = copyStatus as CopyStatus
  if (publicationNotes !== undefined) data.publicationNotes = publicationNotes

  const piece = await prisma.contentPiece.update({
    where: { id: req.params.id },
    data,
    select: PIECE_SELECT,
  })

  if (copyStatus !== undefined) {
    await logPieceHistory(piece.id, req.user!.userId, 'copy_status_changed',
      `Copy actualizado a ${copyStatus}`)
  }

  res.json(piece)
})

// ── PATCH /pieces/:id/schedule ────────────────────────────────────────────────
contentCalendarRouter.patch('/pieces/:id/schedule', isAdminOrLead, async (req, res) => {
  const { scheduledDate, scheduledTime } = req.body

  const prev = await prisma.contentPiece.findUnique({
    where: { id: req.params.id },
    select: { scheduledDate: true, status: true, title: true, client: { select: { name: true } } },
  })
  if (!prev) { res.status(404).json({ error: 'Pieza no encontrada' }); return }

  const isReschedule = !!prev.scheduledDate

  const piece = await prisma.contentPiece.update({
    where: { id: req.params.id },
    data: {
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      scheduledTime: scheduledTime || null,
      status: scheduledDate ? 'programado' : 'listo',
    },
    select: PIECE_SELECT,
  })

  await logPieceHistory(piece.id, req.user!.userId,
    isReschedule ? 'rescheduled' : 'scheduled',
    scheduledDate
      ? `Programada para ${scheduledDate}${scheduledTime ? ` a las ${scheduledTime}` : ''}`
      : 'Quitada del calendario (sin fecha)')

  if (scheduledDate) {
    const adminEmails = await getAdminLeadEmails()
    sendPieceScheduledEmail({
      adminEmails,
      pieceTitle: piece.title,
      clientName: piece.client.name,
      scheduledDate,
      scheduledTime: scheduledTime || null,
    }).catch(console.error)
  }

  res.json(piece)
})

// ── PATCH /pieces/:id/status ──────────────────────────────────────────────────
contentCalendarRouter.patch('/pieces/:id/status', isAdminOrLead, async (req, res) => {
  const { status } = req.body
  if (!status) { res.status(400).json({ error: 'Status requerido' }); return }

  const prev = await prisma.contentPiece.findUnique({
    where: { id: req.params.id }, select: { status: true, scheduledDate: true },
  })
  if (!prev) { res.status(404).json({ error: 'Pieza no encontrada' }); return }

  // Validate: programado requires a date
  if (status === 'programado' && !prev.scheduledDate) {
    res.status(400).json({ error: 'Asigna una fecha antes de programar la pieza' }); return
  }

  const piece = await prisma.contentPiece.update({
    where: { id: req.params.id },
    data: { status: status as ContentPieceStatus },
    select: PIECE_SELECT,
  })

  await logPieceHistory(piece.id, req.user!.userId, 'status_changed',
    `Estado cambiado a ${status}`, { from: prev.status, to: status })

  res.json(piece)
})

// ── PATCH /pieces/:id/publish ─────────────────────────────────────────────────
contentCalendarRouter.patch('/pieces/:id/publish', isAdminOrLead, async (req, res) => {
  const prev = await prisma.contentPiece.findUnique({
    where: { id: req.params.id },
    select: { status: true, title: true, client: { select: { name: true } } },
  })
  if (!prev) { res.status(404).json({ error: 'Pieza no encontrada' }); return }

  const piece = await prisma.contentPiece.update({
    where: { id: req.params.id },
    data: { status: 'publicado', publishedAt: new Date() },
    select: PIECE_SELECT,
  })

  await logPieceHistory(piece.id, req.user!.userId, 'published',
    `Marcada como publicada por ${req.user!.name}`)

  const adminEmails = await getAdminLeadEmails()
  sendPiecePublishedEmail({
    adminEmails,
    pieceTitle: piece.title,
    clientName: piece.client.name,
    publisherName: req.user!.name ?? 'Un admin',
  }).catch(console.error)

  res.json(piece)
})

// ── DELETE /pieces/:id ────────────────────────────────────────────────────────
contentCalendarRouter.delete('/pieces/:id', isAdminOrLead, async (req, res) => {
  try {
    const piece = await prisma.contentPiece.findUnique({
      where: { id: req.params.id },
      select: { id: true, title: true },
    })
    if (!piece) { res.status(404).json({ error: 'Pieza no encontrada' }); return }

    await prisma.contentPieceHistory.deleteMany({ where: { pieceId: req.params.id } })
    await prisma.contentPiece.delete({ where: { id: req.params.id } })

    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al eliminar pieza' })
  }
})

// ── GET /pieces/:id/history ───────────────────────────────────────────────────
contentCalendarRouter.get('/pieces/:id/history', isAdminOrLead, async (req, res) => {
  const history = await prisma.contentPieceHistory.findMany({
    where: { pieceId: req.params.id },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(history)
})
