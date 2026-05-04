import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth } from '../middleware/auth'
import { v4 as uuidv4 } from 'uuid'
import {
  sendCommentNewEmail,
  sendCommentMentionEmail,
  sendCommentReplyEmail,
  sendCommentResolvedEmail,
  sendCommentOnStatusChangeEmail,
} from '../lib/email'

export const briefCommentsRouter = Router({ mergeParams: true })

// ── Shared select ──────────────────────────────────────────────────────────────

const COMMENT_SELECT = {
  id: true,
  briefId: true,
  parentId: true,
  content: true,
  isResolved: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  author:     { select: { id: true, name: true, avatarUrl: true } },
  resolvedBy: { select: { id: true, name: true } },
  mentions:   { select: { user: { select: { id: true, name: true } } } },
}

// ── Extract @mentions from text ───────────────────────────────────────────────

function extractMentionIds(text: string, users: { id: string; name: string }[]): string[] {
  const mentionRegex = /@([\wáéíóúñÁÉÍÓÚÑ\s]+)/gi
  const matches = [...text.matchAll(mentionRegex)].map(m => m[1].toLowerCase().trim())
  return users
    .filter(u => matches.some(m => u.name.toLowerCase().startsWith(m)))
    .map(u => u.id)
}

// ── GET /briefs/:id/comments ──────────────────────────────────────────────────

briefCommentsRouter.get('/', isAuth, async (req, res) => {
  try {
    const comments = await prisma.briefComment.findMany({
      where: { briefId: req.params.id, parentId: null },
      select: {
        ...COMMENT_SELECT,
        replies: {
          select: COMMENT_SELECT,
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    })
    res.json(comments)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al cargar comentarios' })
  }
})

// ── POST /briefs/:id/comments ─────────────────────────────────────────────────

briefCommentsRouter.post('/', isAuth, async (req, res) => {
  const { content } = req.body
  if (!content?.trim()) { res.status(400).json({ error: 'El comentario no puede estar vacío' }); return }

  try {
    // Load all team users to resolve mentions (INVITED included so names resolve, but emails only go to ACTIVE)
    const allUsers = await prisma.user.findMany({
      where: { status: { in: ['ACTIVE', 'INVITED'] } },
      select: { id: true, name: true, email: true, status: true },
    })
    const mentionedIds = extractMentionIds(content, allUsers).filter(id => id !== req.user!.userId)

    const comment = await prisma.briefComment.create({
      data: {
        id: uuidv4(),
        briefId: req.params.id,
        authorId: req.user!.userId,
        content: content.trim(),
        mentions: mentionedIds.length ? {
          create: mentionedIds.map(uid => ({ id: uuidv4(), userId: uid })),
        } : undefined,
      },
      select: {
        ...COMMENT_SELECT,
        replies: { select: COMMENT_SELECT },
      },
    })

    // Load brief for notifications
    const brief = await prisma.contentBrief.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, title: true,
        client: { select: { name: true } },
        createdBy: { select: { id: true, email: true, name: true, status: true } },
        assignees: { select: { user: { select: { id: true, email: true, name: true, status: true } } } },
      },
    })
    if (brief) {
      const actorId = req.user!.userId
      // Notify all active assignees + creator (except author)
      const allRecipients = [
        { id: brief.createdBy.id, email: brief.createdBy.email, name: brief.createdBy.name, status: brief.createdBy.status },
        ...brief.assignees.map(a => a.user),
      ]
      const uniqueRecipients = allRecipients.filter((u, i, arr) =>
        u.id !== actorId && u.status === 'ACTIVE' && arr.findIndex(x => x.id === u.id) === i
      )
      sendCommentNewEmail({ brief, comment: { id: comment.id, content: comment.content }, actorName: req.user!.name!, recipients: uniqueRecipients }).catch(console.error)

      // Notify mentioned users specifically (only ACTIVE)
      if (mentionedIds.length) {
        const mentionedUsers = allUsers.filter(u => mentionedIds.includes(u.id) && u.id !== actorId && u.status === 'ACTIVE')
        sendCommentMentionEmail({ brief, comment: { id: comment.id, content: comment.content }, actorName: req.user!.name!, mentionedUsers }).catch(console.error)
      }
    }

    res.status(201).json(comment)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al crear comentario' })
  }
})

// ── POST /briefs/:id/comments/:commentId/replies ──────────────────────────────

briefCommentsRouter.post('/:commentId/replies', isAuth, async (req, res) => {
  const { content } = req.body
  if (!content?.trim()) { res.status(400).json({ error: 'La respuesta no puede estar vacía' }); return }

  try {
    const parent = await prisma.briefComment.findUnique({
      where: { id: req.params.commentId },
      select: { id: true, authorId: true, briefId: true, author: { select: { email: true, name: true, status: true } } },
    })
    if (!parent || parent.briefId !== req.params.id) {
      res.status(404).json({ error: 'Comentario no encontrado' }); return
    }

    const allUsers = await prisma.user.findMany({
      where: { status: { in: ['ACTIVE', 'INVITED'] } },
      select: { id: true, name: true, email: true, status: true },
    })
    const mentionedIds = extractMentionIds(content, allUsers).filter(id => id !== req.user!.userId)

    const reply = await prisma.briefComment.create({
      data: {
        id: uuidv4(),
        briefId: req.params.id,
        authorId: req.user!.userId,
        parentId: req.params.commentId,
        content: content.trim(),
        mentions: mentionedIds.length ? {
          create: mentionedIds.map(uid => ({ id: uuidv4(), userId: uid })),
        } : undefined,
      },
      select: COMMENT_SELECT,
    })

    // Load brief for notifications
    const brief = await prisma.contentBrief.findUnique({
      where: { id: req.params.id },
      select: { id: true, title: true, client: { select: { name: true } } },
    })
    if (brief) {
      const actorId = req.user!.userId
      // Notify parent comment author (only if ACTIVE)
      if (parent.authorId !== actorId && parent.author.status === 'ACTIVE') {
        sendCommentReplyEmail({ brief, comment: { id: reply.id, content: reply.content }, actorName: req.user!.name!, parentAuthor: parent.author }).catch(console.error)
      }
      // Notify mentions (only ACTIVE)
      if (mentionedIds.length) {
        const mentionedUsers = allUsers.filter(u => mentionedIds.includes(u.id) && u.id !== actorId && u.status === 'ACTIVE')
        sendCommentMentionEmail({ brief, comment: { id: reply.id, content: reply.content }, actorName: req.user!.name!, mentionedUsers }).catch(console.error)
      }
    }

    res.status(201).json(reply)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al responder comentario' })
  }
})

// ── PUT /briefs/:id/comments/:commentId — edit (within 10 min) ────────────────

briefCommentsRouter.put('/:commentId', isAuth, async (req, res) => {
  const { content } = req.body
  if (!content?.trim()) { res.status(400).json({ error: 'El comentario no puede estar vacío' }); return }
  try {
    const existing = await prisma.briefComment.findUnique({
      where: { id: req.params.commentId },
      select: { authorId: true, createdAt: true, briefId: true },
    })
    if (!existing || existing.briefId !== req.params.id) {
      res.status(404).json({ error: 'Comentario no encontrado' }); return
    }
    if (existing.authorId !== req.user!.userId) {
      res.status(403).json({ error: 'Solo el autor puede editar este comentario' }); return
    }
    const minsElapsed = (Date.now() - existing.createdAt.getTime()) / 60000
    if (minsElapsed > 10) {
      res.status(403).json({ error: 'Solo se puede editar dentro de los primeros 10 minutos' }); return
    }

    // Re-extract mentions (INVITED included so names resolve; email filtering happens at send time)
    const allUsers = await prisma.user.findMany({
      where: { status: { in: ['ACTIVE', 'INVITED'] } },
      select: { id: true, name: true },
    })
    const mentionedIds = extractMentionIds(content, allUsers).filter(id => id !== req.user!.userId)

    await prisma.commentMention.deleteMany({ where: { commentId: req.params.commentId } })

    const updated = await prisma.briefComment.update({
      where: { id: req.params.commentId },
      data: {
        content: content.trim(),
        mentions: mentionedIds.length ? {
          create: mentionedIds.map(uid => ({ id: uuidv4(), userId: uid })),
        } : undefined,
      },
      select: COMMENT_SELECT,
    })
    res.json(updated)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al editar comentario' })
  }
})

// ── PATCH /briefs/:id/comments/:commentId/resolve ─────────────────────────────

briefCommentsRouter.patch('/:commentId/resolve', isAuth, async (req, res) => {
  try {
    const existing = await prisma.briefComment.findUnique({
      where: { id: req.params.commentId },
      select: { authorId: true, isResolved: true, briefId: true, author: { select: { email: true, name: true, status: true } } },
    })
    if (!existing || existing.briefId !== req.params.id) {
      res.status(404).json({ error: 'Comentario no encontrado' }); return
    }
    const role = req.user!.role
    if (existing.authorId !== req.user!.userId && role !== 'ADMIN' && role !== 'LEAD') {
      res.status(403).json({ error: 'Solo el autor o un administrador puede resolver este comentario' }); return
    }

    const resolved = await prisma.briefComment.update({
      where: { id: req.params.commentId },
      data: { isResolved: true, resolvedById: req.user!.userId, resolvedAt: new Date() },
      select: COMMENT_SELECT,
    })

    // Notify the comment author (if someone else resolved it and they are ACTIVE)
    if (existing.authorId !== req.user!.userId && existing.author.status === 'ACTIVE') {
      const brief = await prisma.contentBrief.findUnique({
        where: { id: req.params.id },
        select: { id: true, title: true, client: { select: { name: true } } },
      })
      if (brief) {
        sendCommentResolvedEmail({ brief, comment: { id: resolved.id, content: resolved.content }, actorName: req.user!.name!, commentAuthor: existing.author }).catch(console.error)
      }
    }

    res.json(resolved)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al resolver comentario' })
  }
})

// ── DELETE /briefs/:id/comments/:commentId ────────────────────────────────────

briefCommentsRouter.delete('/:commentId', isAuth, async (req, res) => {
  try {
    const existing = await prisma.briefComment.findUnique({
      where: { id: req.params.commentId },
      select: { authorId: true, briefId: true },
    })
    if (!existing || existing.briefId !== req.params.id) {
      res.status(404).json({ error: 'Comentario no encontrado' }); return
    }
    const role = req.user!.role
    if (existing.authorId !== req.user!.userId && role !== 'ADMIN') {
      res.status(403).json({ error: 'Sin permiso para eliminar este comentario' }); return
    }
    await prisma.briefComment.delete({ where: { id: req.params.commentId } })
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al eliminar comentario' })
  }
})

// ── POST /briefs/:id/comments/status-note ─────────────────────────────────────
// Called when admin/lead changes status and optionally adds a note

briefCommentsRouter.post('/status-note', isAuth, async (req, res) => {
  const { content, newStatus } = req.body
  if (!content?.trim()) { res.json({ skipped: true }); return }

  try {
    const allUsers = await prisma.user.findMany({
      where: { status: { in: ['ACTIVE', 'INVITED'] } },
      select: { id: true, name: true, email: true, status: true },
    })
    const mentionedIds = extractMentionIds(content, allUsers).filter(id => id !== req.user!.userId)

    const comment = await prisma.briefComment.create({
      data: {
        id: uuidv4(),
        briefId: req.params.id,
        authorId: req.user!.userId,
        content: content.trim(),
        mentions: mentionedIds.length ? {
          create: mentionedIds.map(uid => ({ id: uuidv4(), userId: uid })),
        } : undefined,
      },
      select: {
        ...COMMENT_SELECT,
        replies: { select: COMMENT_SELECT },
      },
    })

    const brief = await prisma.contentBrief.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, title: true,
        client: { select: { name: true } },
        createdBy: { select: { id: true, email: true, name: true, status: true } },
        assignees: { select: { user: { select: { id: true, email: true, name: true, status: true } } } },
      },
    })
    if (brief) {
      const actorId = req.user!.userId
      const allRecipients = [
        { id: brief.createdBy.id, email: brief.createdBy.email, name: brief.createdBy.name, status: brief.createdBy.status },
        ...brief.assignees.map(a => a.user),
      ]
      const uniqueRecipients = allRecipients.filter((u, i, arr) =>
        u.id !== actorId && u.status === 'ACTIVE' && arr.findIndex(x => x.id === u.id) === i
      )
      sendCommentOnStatusChangeEmail({
        brief,
        comment: { id: comment.id, content: comment.content },
        actorName: req.user!.name!,
        newStatus,
        recipients: uniqueRecipients,
      }).catch(console.error)
    }

    res.status(201).json(comment)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al guardar nota' })
  }
})
