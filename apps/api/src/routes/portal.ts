/**
 * portal.ts — Public client portal API.
 *
 * No auth required — all endpoints are gated by the :token param.
 * Token validates client identity without login.
 */

import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { randomBytes, createHash } from 'crypto'
import {
  sendPortalLinkEmail,
  sendClientApprovedEmail,
  sendClientChangesEmail,
  sendAllApprovedEmail,
} from '../lib/email'
import { isAuth, isAdmin } from '../middleware/auth'

export const portalRouter = Router()

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthEndPlusWeek(): Date {
  const d = new Date()
  // Last day of current month
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  // +7 days grace
  lastDay.setDate(lastDay.getDate() + 7)
  return lastDay
}

function monthLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })
}

function generateToken(): string {
  return randomBytes(32).toString('hex')
}

async function getAdminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'LEAD'] }, status: 'ACTIVE' },
    select: { email: true },
  })
  return admins.map(u => u.email)
}

// Resolve the portal token row — returns null if not found or expired
async function resolveToken(token: string) {
  const row = await prisma.clientPortalToken.findUnique({
    where: { token },
    include: { client: { select: { id: true, name: true, contacts: { where: { isPrimary: true }, select: { email: true, name: true } } } } },
  })
  if (!row) return null
  if (new Date() > row.expiresAt) return null
  return row
}

// ── Admin: generate / refresh token for a client ─────────────────────────────

portalRouter.post('/admin/clients/:clientId/portal-token', isAdmin, async (req, res) => {
  const { clientId } = req.params
  const month = (req.body.month as string | undefined) || currentMonth()

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { contacts: { where: { isPrimary: true }, select: { email: true } } },
  })
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' })

  const token = generateToken()
  const expiresAt = monthEndPlusWeek()

  const row = await prisma.clientPortalToken.upsert({
    where: { clientId_month: { clientId, month } },
    create: { clientId, token, month, expiresAt },
    update: { token, expiresAt }, // refresh token on re-generate
  })

  const appUrl = process.env.APP_URL || 'https://processa.hax.com.do'
  const portalUrl = `${appUrl}/cliente/${row.token}`

  // Optionally send email
  if (req.body.sendEmail) {
    const primaryEmail = client.contacts[0]?.email
    if (primaryEmail) {
      await sendPortalLinkEmail({
        to: primaryEmail,
        clientName: client.name,
        month: monthLabel(month),
        portalUrl,
      }).catch(e => console.error('[Portal] send email error:', e))
    }
  }

  return res.json({
    token: row.token,
    month: row.month,
    expiresAt: row.expiresAt,
    portalUrl,
    emailSent: !!(req.body.sendEmail && client.contacts[0]?.email),
  })
})

// ── Admin: get current token info for a client ────────────────────────────────

portalRouter.get('/admin/clients/:clientId/portal-token', isAuth, async (req, res) => {
  const { clientId } = req.params
  const month = (req.query.month as string | undefined) || currentMonth()

  const row = await prisma.clientPortalToken.findUnique({
    where: { clientId_month: { clientId, month } },
    select: { token: true, month: true, expiresAt: true, createdAt: true },
  })
  if (!row) return res.json(null)

  const appUrl = process.env.APP_URL || 'https://processa.hax.com.do'
  return res.json({ ...row, portalUrl: `${appUrl}/cliente/${row.token}` })
})

// ── Admin: set monthly objectives ─────────────────────────────────────────────

portalRouter.put('/admin/clients/:clientId/monthly-objectives', isAdmin, async (req, res) => {
  const { clientId } = req.params
  const { month, engagementGoal, reachGoal, followersGoal, leadsGoal } = req.body
  const m = month || currentMonth()

  // @ts-ignore — user comes from isAdmin middleware
  const userId = req.user.userId

  const obj = await prisma.clientMonthlyObjective.upsert({
    where: { clientId_month: { clientId, month: m } },
    create: { clientId, month: m, engagementGoal, reachGoal, followersGoal, leadsGoal, createdById: userId },
    update: { engagementGoal, reachGoal, followersGoal, leadsGoal },
  })
  return res.json(obj)
})

portalRouter.get('/admin/clients/:clientId/monthly-objectives', isAuth, async (req, res) => {
  const { clientId } = req.params
  const month = (req.query.month as string | undefined) || currentMonth()

  const obj = await prisma.clientMonthlyObjective.findUnique({
    where: { clientId_month: { clientId, month } },
  })
  return res.json(obj)
})

// ── PUBLIC: validate token + return portal data ───────────────────────────────

portalRouter.get('/:token', async (req, res) => {
  const tokenRow = await resolveToken(req.params.token)
  if (!tokenRow) {
    return res.status(401).json({ error: 'Token inválido o expirado', expired: true })
  }

  const { clientId, month } = tokenRow

  // Fetch content pieces for this client in this month
  const [y, m] = month.split('-').map(Number)
  const monthStart = new Date(y, m - 1, 1)
  const monthEnd   = new Date(y, m, 0)    // last day

  const [pieces, briefs, objective, approvals] = await Promise.all([
    prisma.contentPiece.findMany({
      where: {
        clientId,
        OR: [
          { scheduledDate: { gte: monthStart, lte: monthEnd } },
          { scheduledDate: null, createdAt: { gte: monthStart, lte: monthEnd } },
        ],
        status: { notIn: ['cancelado'] },
      },
      orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, title: true, type: true, platforms: true, status: true,
        copy: true, hashtags: true, referencesUrls: true, publicationNotes: true,
        scheduledDate: true, scheduledTime: true,
        briefId: true,
        brief: {
          select: {
            files: {
              where: { mimeType: { startsWith: 'image/' } },
              select: { id: true },
              orderBy: { createdAt: 'asc' },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.contentBrief.findMany({
      where: { clientId, status: 'aprobacion_cliente' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, type: true, platforms: true, status: true,
        concept: true, script: true, copyDraft: true, hashtags: true,
        referencesUrls: true, technicalNotes: true,
        files: {
          select: { id: true, originalName: true, mimeType: true, sizeBytes: true, label: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    prisma.clientMonthlyObjective.findUnique({
      where: { clientId_month: { clientId, month } },
      select: { engagementGoal: true, reachGoal: true, followersGoal: true, leadsGoal: true },
    }),
    prisma.clientContentApproval.findMany({
      where: { clientId, token: { month } },
      orderBy: { actionedAt: 'desc' },
      select: { pieceId: true, briefId: true, action: true, changeType: true, feedback: true, actionedAt: true },
    }),
  ])

  // Build approval map for quick lookup
  const pieceApprovalMap: Record<string, { action: string; changeType: string | null; feedback: string | null }> = {}
  const briefApprovalMap: Record<string, { action: string; changeType: string | null; feedback: string | null }> = {}
  for (const a of approvals) {
    if (a.pieceId && !pieceApprovalMap[a.pieceId]) {
      pieceApprovalMap[a.pieceId] = { action: a.action, changeType: a.changeType, feedback: a.feedback }
    }
    if (a.briefId && !briefApprovalMap[a.briefId]) {
      briefApprovalMap[a.briefId] = { action: a.action, changeType: a.changeType, feedback: a.feedback }
    }
  }

  // Annotate pieces with approval status from this portal
  const annotatedPieces = pieces.map(p => ({
    ...p,
    scheduledDate: p.scheduledDate ? p.scheduledDate.toISOString().split('T')[0] : null,
    coverImageFileId: p.brief?.files?.[0]?.id ?? null,
    brief: undefined,
    portalApproval: pieceApprovalMap[p.id] ?? null,
  }))

  const annotatedBriefs = briefs.map(b => ({
    ...b,
    portalApproval: briefApprovalMap[b.id] ?? null,
  }))

  // Stats
  const stories = annotatedPieces.filter(p => p.type === 'story')
  const mainPieces = annotatedPieces.filter(p => p.type !== 'story')
  const pendingMain = mainPieces.filter(p => !pieceApprovalMap[p.id])
  const pendingStories = stories.filter(p => !pieceApprovalMap[p.id])

  return res.json({
    client:    { id: tokenRow.client.id, name: tokenRow.client.name },
    month,
    monthLabel: monthLabel(month),
    expiresAt: tokenRow.expiresAt,
    objective,
    pieces:    annotatedPieces,
    briefs:    annotatedBriefs,
    history:   approvals.map(a => ({
      ...a,
      actionedAt: a.actionedAt.toISOString(),
    })),
    stats: {
      mainPieces:    mainPieces.length,
      mainApproved:  mainPieces.length - pendingMain.length,
      mainPending:   pendingMain.length,
      stories:       stories.length,
      storiesApproved: stories.length - pendingStories.length,
      storiesPending:  pendingStories.length,
      totalPending:  pendingMain.length + pendingStories.length,
      briefs:        briefs.length,
      briefsPending: annotatedBriefs.filter(b => !briefApprovalMap[b.id]).length,
    },
  })
})

// ── PUBLIC: approve a piece ───────────────────────────────────────────────────

portalRouter.post('/:token/approve/:pieceId', async (req, res) => {
  const tokenRow = await resolveToken(req.params.token)
  if (!tokenRow) return res.status(401).json({ error: 'Token inválido o expirado' })

  const { pieceId } = req.params

  const piece = await prisma.contentPiece.findFirst({
    where: { id: pieceId, clientId: tokenRow.clientId },
    select: { id: true, title: true, status: true },
  })
  if (!piece) return res.status(404).json({ error: 'Pieza no encontrada' })

  // Record approval
  await prisma.clientContentApproval.create({
    data: {
      pieceId,
      clientId: tokenRow.clientId,
      tokenId: tokenRow.id,
      action: 'approved',
    },
  })

  // Auto-advance status: en_revision → listo
  if (piece.status === 'en_revision' || piece.status === 'listo') {
    await prisma.contentPiece.update({
      where: { id: pieceId },
      data: { status: 'listo' },
    })
  }

  // Notify team
  const appUrl = process.env.APP_URL || 'https://processa.hax.com.do'
  const adminEmails = await getAdminEmails()
  sendClientApprovedEmail({
    adminEmails,
    clientName: tokenRow.client.name,
    pieceName:  piece.title,
    month:      monthLabel(tokenRow.month),
    portalUrl:  `${appUrl}/content/calendar`,
  }).catch(e => console.error('[Portal] approve email error:', e))

  // Check if ALL pieces are now approved
  const { month } = tokenRow
  const [y, m] = month.split('-').map(Number)
  const monthStart = new Date(y, m - 1, 1)
  const monthEnd   = new Date(y, m, 0)

  const allPieces = await prisma.contentPiece.findMany({
    where: { clientId: tokenRow.clientId, scheduledDate: { gte: monthStart, lte: monthEnd }, status: { notIn: ['cancelado'] } },
    select: { id: true },
  })
  const allApprovals = await prisma.clientContentApproval.findMany({
    where: { clientId: tokenRow.clientId, token: { month }, action: 'approved' },
    select: { pieceId: true },
  })
  const approvedIds = new Set(allApprovals.map(a => a.pieceId))
  const allApproved = allPieces.every(p => approvedIds.has(p.id))

  if (allApproved && allPieces.length > 0) {
    sendAllApprovedEmail({
      adminEmails,
      clientName:  tokenRow.client.name,
      month:       monthLabel(month),
      totalPieces: allPieces.length,
    }).catch(e => console.error('[Portal] all approved email error:', e))
  }

  return res.json({ ok: true, allApproved })
})

// ── PUBLIC: approve a brief ───────────────────────────────────────────────────

portalRouter.post('/:token/approve-brief/:briefId', async (req, res) => {
  const tokenRow = await resolveToken(req.params.token)
  if (!tokenRow) return res.status(401).json({ error: 'Token inválido o expirado' })

  const { briefId } = req.params

  const brief = await prisma.contentBrief.findFirst({
    where: { id: briefId, clientId: tokenRow.clientId },
    select: { id: true, title: true },
  })
  if (!brief) return res.status(404).json({ error: 'Brief no encontrado' })

  await prisma.clientContentApproval.create({
    data: {
      briefId,
      clientId: tokenRow.clientId,
      tokenId: tokenRow.id,
      action: 'approved',
    },
  })

  // Auto-advance brief status
  await prisma.contentBrief.update({
    where: { id: briefId },
    data: { status: 'aprobado' },
  })

  const appUrl = process.env.APP_URL || 'https://processa.hax.com.do'
  const adminEmails = await getAdminEmails()
  sendClientApprovedEmail({
    adminEmails,
    clientName: tokenRow.client.name,
    pieceName:  brief.title,
    month:      monthLabel(tokenRow.month),
    portalUrl:  `${appUrl}/content/briefs`,
  }).catch(e => console.error('[Portal] brief approve email error:', e))

  return res.json({ ok: true })
})

// ── PUBLIC: request changes on a piece ───────────────────────────────────────

portalRouter.post('/:token/changes/:pieceId', async (req, res) => {
  const tokenRow = await resolveToken(req.params.token)
  if (!tokenRow) return res.status(401).json({ error: 'Token inválido o expirado' })

  const { pieceId } = req.params
  const { changeType, feedback } = req.body

  const piece = await prisma.contentPiece.findFirst({
    where: { id: pieceId, clientId: tokenRow.clientId },
    select: { id: true, title: true },
  })
  if (!piece) return res.status(404).json({ error: 'Pieza no encontrada' })

  await prisma.clientContentApproval.create({
    data: {
      pieceId,
      clientId:   tokenRow.clientId,
      tokenId:    tokenRow.id,
      action:     'changes_requested',
      changeType: changeType || null,
      feedback:   feedback   || null,
    },
  })

  // Move piece to en_revision
  await prisma.contentPiece.update({
    where: { id: pieceId },
    data: { status: 'en_revision' },
  })

  const appUrl = process.env.APP_URL || 'https://processa.hax.com.do'
  const adminEmails = await getAdminEmails()
  sendClientChangesEmail({
    adminEmails,
    clientName: tokenRow.client.name,
    pieceName:  piece.title,
    changeType: changeType || null,
    feedback:   feedback   || null,
    month:      monthLabel(tokenRow.month),
    portalUrl:  `${appUrl}/content/calendar`,
  }).catch(e => console.error('[Portal] changes email error:', e))

  return res.json({ ok: true })
})

// ── PUBLIC: request changes on a brief ───────────────────────────────────────

portalRouter.post('/:token/changes-brief/:briefId', async (req, res) => {
  const tokenRow = await resolveToken(req.params.token)
  if (!tokenRow) return res.status(401).json({ error: 'Token inválido o expirado' })

  const { briefId } = req.params
  const { changeType, feedback } = req.body

  const brief = await prisma.contentBrief.findFirst({
    where: { id: briefId, clientId: tokenRow.clientId },
    select: { id: true, title: true },
  })
  if (!brief) return res.status(404).json({ error: 'Brief no encontrado' })

  await prisma.clientContentApproval.create({
    data: {
      briefId,
      clientId:   tokenRow.clientId,
      tokenId:    tokenRow.id,
      action:     'changes_requested',
      changeType: changeType || null,
      feedback:   feedback   || null,
    },
  })

  // Move brief back to en_desarrollo + save note
  await prisma.contentBrief.update({
    where: { id: briefId },
    data: {
      status: 'en_desarrollo',
      clientApprovalNotes: feedback || null,
    },
  })

  const appUrl = process.env.APP_URL || 'https://processa.hax.com.do'
  const adminEmails = await getAdminEmails()
  sendClientChangesEmail({
    adminEmails,
    clientName: tokenRow.client.name,
    pieceName:  brief.title,
    changeType: changeType || null,
    feedback:   feedback   || null,
    month:      monthLabel(tokenRow.month),
    portalUrl:  `${appUrl}/content/briefs`,
  }).catch(e => console.error('[Portal] brief changes email error:', e))

  return res.json({ ok: true })
})

// ── PUBLIC: approve ALL pending pieces in bulk ────────────────────────────────

portalRouter.post('/:token/approve-all', async (req, res) => {
  const tokenRow = await resolveToken(req.params.token)
  if (!tokenRow) return res.status(401).json({ error: 'Token inválido o expirado' })

  const { month, clientId } = tokenRow
  const [y, m] = month.split('-').map(Number)
  const monthStart = new Date(y, m - 1, 1)
  const monthEnd   = new Date(y, m, 0)

  // Get all non-cancelled pieces for this month
  const allPieces = await prisma.contentPiece.findMany({
    where: { clientId, scheduledDate: { gte: monthStart, lte: monthEnd }, status: { notIn: ['cancelado'] } },
    select: { id: true, title: true },
  })

  // Get already approved piece IDs
  const existing = await prisma.clientContentApproval.findMany({
    where: { clientId, token: { month }, action: 'approved', pieceId: { not: null } },
    select: { pieceId: true },
  })
  const alreadyApprovedIds = new Set(existing.map(a => a.pieceId))

  // Only approve pieces not yet approved
  const toApprove = allPieces.filter(p => !alreadyApprovedIds.has(p.id))
  if (toApprove.length === 0) {
    return res.json({ ok: true, approved: 0 })
  }

  await prisma.$transaction([
    prisma.clientContentApproval.createMany({
      data: toApprove.map(p => ({
        pieceId:  p.id,
        clientId,
        tokenId:  tokenRow.id,
        action:   'approved',
      })),
    }),
    prisma.contentPiece.updateMany({
      where: { id: { in: toApprove.map(p => p.id) }, status: 'en_revision' },
      data:  { status: 'listo' },
    }),
  ])

  const appUrl = process.env.APP_URL || 'https://processa.hax.com.do'
  const adminEmails = await getAdminEmails()
  sendAllApprovedEmail({
    adminEmails,
    clientName:  tokenRow.client.name,
    month:       monthLabel(month),
    totalPieces: allPieces.length,
  }).catch(e => console.error('[Portal] approve-all email error:', e))

  return res.json({ ok: true, approved: toApprove.length })
})
