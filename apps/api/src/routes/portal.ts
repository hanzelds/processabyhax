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
import { isAuth, isAdmin, isAdminOrLead } from '../middleware/auth'

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

portalRouter.get('/admin/clients/:clientId/portal-token', isAdminOrLead, async (req, res) => {
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

portalRouter.get('/admin/clients/:clientId/monthly-objectives', isAdminOrLead, async (req, res) => {
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
    // Unified: pieces needing content review OR date confirmation
    prisma.contentPiece.findMany({
      where: {
        clientId,
        OR: [{ status: 'en_revision' }, { calendarDraft: true }],
      },
      orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, title: true, type: true, platforms: true, status: true,
        copy: true, hashtags: true, referencesUrls: true, publicationNotes: true,
        scheduledDate: true, scheduledTime: true, calendarDraft: true,
        briefId: true,
        brief: {
          select: {
            concept: true, script: true, copyDraft: true,
            hashtags: true, referencesUrls: true, technicalNotes: true,
            files: {
              select: { id: true, originalName: true, mimeType: true, sizeBytes: true, label: true, createdAt: true },
              orderBy: { createdAt: 'asc' },
            },
            scripts: {
              select: { id: true, title: true, status: true, type: true, content: true },
              where: { status: { not: 'archivado' } },
              orderBy: { createdAt: 'asc' as const },
            },
          },
        },
        // Include all recent approvals so we can split content vs date
        clientApprovals: {
          orderBy: { actionedAt: 'desc' as const },
          take: 10,
          select: { action: true, changeType: true, feedback: true, actionedAt: true },
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
        scripts: {
          select: { id: true, title: true, status: true, type: true, content: true },
          where: { status: { not: 'archivado' } },
          orderBy: { createdAt: 'asc' as const },
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

  // Build brief approval map
  const briefApprovalMap: Record<string, { action: string; changeType: string | null; feedback: string | null }> = {}
  for (const a of approvals) {
    if (a.briefId && !briefApprovalMap[a.briefId]) {
      briefApprovalMap[a.briefId] = { action: a.action, changeType: a.changeType, feedback: a.feedback }
    }
  }

  // Annotate pieces — split approvals into contentApproval vs dateApproval
  const annotatedPieces = pieces.map(p => {
    const contentApproval = p.clientApprovals.find(a => a.changeType !== 'date') ?? null
    const dateApproval    = p.clientApprovals.find(a => a.changeType === 'date') ?? null
    const brief = p.brief
    // Cover image: first image file from the brief
    const coverImageFileId = brief?.files?.find(f => f.mimeType.startsWith('image/'))?.id ?? null
    return {
      id: p.id, title: p.title, type: p.type, platforms: p.platforms, status: p.status,
      // Piece's own fields
      copy: p.copy, hashtags: p.hashtags ?? brief?.hashtags ?? null,
      referencesUrls: p.referencesUrls?.length ? p.referencesUrls : (brief?.referencesUrls ?? []),
      publicationNotes: p.publicationNotes,
      scheduledDate: p.scheduledDate ? p.scheduledDate.toISOString().split('T')[0] : null,
      scheduledTime: p.scheduledTime, calendarDraft: p.calendarDraft,
      briefId: p.briefId,
      coverImageFileId,
      scripts: brief?.scripts ?? [],
      // Brief content fields (concept, script text, copyDraft, technicalNotes, files)
      concept: brief?.concept ?? null,
      script: brief?.script ?? null,
      copyDraft: brief?.copyDraft ?? null,
      technicalNotes: brief?.technicalNotes ?? null,
      briefFiles: brief?.files ?? [],
      contentApproval: contentApproval ? { action: contentApproval.action, changeType: contentApproval.changeType, feedback: contentApproval.feedback } : null,
      dateApproval: dateApproval ? { action: dateApproval.action, changeType: dateApproval.changeType, feedback: dateApproval.feedback } : null,
      portalApproval: contentApproval ? { action: contentApproval.action, changeType: contentApproval.changeType, feedback: contentApproval.feedback } : null,
    }
  })

  const annotatedBriefs = briefs.map(b => ({
    ...b,
    portalApproval: briefApprovalMap[b.id] ?? null,
  }))

  // Stats
  const stories    = annotatedPieces.filter(p => p.type === 'story')
  const mainPieces = annotatedPieces.filter(p => p.type !== 'story')
  const pendingMain    = mainPieces.filter(p => p.status === 'en_revision' && !p.contentApproval)
  const pendingStories = stories.filter(p => p.status === 'en_revision' && !p.contentApproval)

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
    select: { id: true, title: true, status: true, briefId: true },
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

  // Auto-advance piece: en_revision → listo
  if (piece.status === 'en_revision' || piece.status === 'listo') {
    await prisma.contentPiece.update({
      where: { id: pieceId },
      data: { status: 'listo' },
    })
  }

  // If piece is linked to a brief in aprobacion_cliente → advance brief to aprobado
  if (piece.briefId) {
    const brief = await prisma.contentBrief.findUnique({
      where: { id: piece.briefId },
      select: { id: true, status: true },
    })
    if (brief && brief.status === 'aprobacion_cliente') {
      await prisma.contentBrief.update({
        where: { id: piece.briefId },
        data: { status: 'aprobado' },
      })
    }
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
    select: {
      id: true, title: true,
      _count: { select: { files: true } },
      scripts: { select: { id: true }, where: { status: { not: 'archivado' } } },
    },
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

  // Approve brief + all linked scripts in one transaction — always goes to aprobado first
  await prisma.$transaction([
    prisma.contentBrief.update({
      where: { id: briefId },
      data: { status: 'aprobado' },
    }),
    ...(brief.scripts.length > 0 ? [
      prisma.script.updateMany({
        where: { id: { in: brief.scripts.map(s => s.id) } },
        data: { status: 'aprobado' },
      }),
    ] : []),
  ])

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
    select: { id: true, title: true, briefId: true },
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

  // If linked brief is in aprobacion_cliente → save feedback in clientApprovalNotes (don't move status)
  if (piece.briefId && feedback) {
    await prisma.contentBrief.updateMany({
      where: { id: piece.briefId, status: 'aprobacion_cliente' },
      data: { clientApprovalNotes: feedback },
    })
  }

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

  // Move brief back to revision_interna + save note
  await prisma.contentBrief.update({
    where: { id: briefId },
    data: {
      status: 'revision_interna',
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

// ── PUBLIC: approve a proposed calendar date ─────────────────────────────────

portalRouter.post('/:token/approve-date/:pieceId', async (req, res) => {
  const tokenRow = await resolveToken(req.params.token)
  if (!tokenRow) return res.status(401).json({ error: 'Token inválido o expirado' })

  const { pieceId } = req.params

  const piece = await prisma.contentPiece.findFirst({
    where: { id: pieceId, clientId: tokenRow.clientId, calendarDraft: true },
    select: { id: true, title: true, scheduledDate: true, scheduledTime: true },
  })
  if (!piece) return res.status(404).json({ error: 'Pieza no encontrada o ya confirmada' })

  // Record approval for the date
  await prisma.clientContentApproval.create({
    data: {
      pieceId,
      clientId:   tokenRow.clientId,
      tokenId:    tokenRow.id,
      action:     'approved',
      changeType: 'date',
    },
  })

  // Confirm: calendarDraft=false, status=programado
  await prisma.contentPiece.update({
    where: { id: pieceId },
    data: { calendarDraft: false, status: 'programado' },
  })

  const appUrl = process.env.APP_URL || 'https://processa.hax.com.do'
  const adminEmails = await getAdminEmails()
  sendClientApprovedEmail({
    adminEmails,
    clientName: tokenRow.client.name,
    pieceName:  `${piece.title} (fecha ${piece.scheduledDate ? piece.scheduledDate.toISOString().split('T')[0] : ''}${piece.scheduledTime ? ' ' + piece.scheduledTime : ''})`,
    month:      monthLabel(tokenRow.month),
    portalUrl:  `${appUrl}/content/calendar`,
  }).catch(e => console.error('[Portal] approve-date email error:', e))

  return res.json({ ok: true })
})

// ── PUBLIC: request changes or reject a proposed calendar date ────────────────

portalRouter.post('/:token/changes-date/:pieceId', async (req, res) => {
  const tokenRow = await resolveToken(req.params.token)
  if (!tokenRow) return res.status(401).json({ error: 'Token inválido o expirado' })

  const { pieceId } = req.params
  const { feedback, clearDate } = req.body  // clearDate=true → reject (remove date); false → request change (keep draft visible)

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
      changeType: 'date',
      feedback:   feedback || null,
    },
  })

  if (clearDate) {
    // Reject: remove date, clear draft flag, piece returns to inbox
    await prisma.contentPiece.update({
      where: { id: pieceId },
      data: { calendarDraft: false, scheduledDate: null, scheduledTime: null, status: 'listo' },
    })
  }
  // If !clearDate, piece stays with calendarDraft=true (team will re-propose)

  const appUrl = process.env.APP_URL || 'https://processa.hax.com.do'
  const adminEmails = await getAdminEmails()
  sendClientChangesEmail({
    adminEmails,
    clientName: tokenRow.client.name,
    pieceName:  piece.title,
    changeType: 'date',
    feedback:   feedback || null,
    month:      monthLabel(tokenRow.month),
    portalUrl:  `${appUrl}/content/calendar`,
  }).catch(e => console.error('[Portal] changes-date email error:', e))

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
