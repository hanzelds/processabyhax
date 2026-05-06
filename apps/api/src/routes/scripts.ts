import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdmin } from '../middleware/auth'

const router = Router()

const SCRIPT_INCLUDE = {
  brief: { select: { id: true, title: true, type: true, status: true, concept: true, script: true } },
  client: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, avatarUrl: true } },
  updatedBy: { select: { id: true, name: true, avatarUrl: true } },
  _count: { select: { versions: true, comments: true } },
}

// GET /api/scripts
router.get('/', isAuth, async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.user!
    const { clientId, briefId, status } = req.query

    const where: any = {}
    if (clientId) where.clientId = clientId as string
    if (briefId)  where.briefId  = briefId  as string
    if (status)   where.status   = status   as string

    if (role === 'TEAM') {
      where.brief = { assignees: { some: { userId } } }
    }

    const scripts = await prisma.script.findMany({
      where,
      include: SCRIPT_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    })
    res.json(scripts)
  } catch (e) {
    res.status(500).json({ error: 'Error loading scripts' })
  }
})

// GET /api/scripts/mine
router.get('/mine', isAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!
    const scripts = await prisma.script.findMany({
      where: {
        brief: { assignees: { some: { userId } } },
        status: { not: 'archivado' },
      },
      include: SCRIPT_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      take: 20,
    })
    res.json(scripts)
  } catch (e) {
    res.status(500).json({ error: 'Error loading scripts' })
  }
})

// GET /api/scripts/:id
router.get('/:id', isAuth, async (req: Request, res: Response) => {
  try {
    const script = await prisma.script.findUnique({
      where: { id: req.params.id },
      include: {
        ...SCRIPT_INCLUDE,
        versions: {
          include: { savedBy: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { version: 'desc' },
          take: 20,
        },
        comments: {
          where: { parentId: null },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
            replies: {
              include: { author: { select: { id: true, name: true, avatarUrl: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    if (!script) return res.status(404).json({ error: 'Not found' })
    res.json(script)
  } catch (e) {
    res.status(500).json({ error: 'Error loading script' })
  }
})

// POST /api/scripts — create
router.post('/', isAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!
    const { briefId, title } = req.body
    if (!briefId || !title) return res.status(400).json({ error: 'briefId and title required' })

    const brief = await prisma.contentBrief.findUnique({
      where: { id: briefId },
      select: { id: true, clientId: true, type: true },
    })
    if (!brief) return res.status(404).json({ error: 'Brief not found' })

    const script = await prisma.script.create({
      data: {
        brief:     { connect: { id: briefId } },
        client:    { connect: { id: brief.clientId } },
        title,
        type:      brief.type,
        status:    'borrador',
        content:   [],
        createdBy: { connect: { id: userId } },
        updatedBy: { connect: { id: userId } },
      },
      include: SCRIPT_INCLUDE,
    })
    res.status(201).json(script)
  } catch (e: any) {
    console.error('[scripts POST]', e?.message)
    res.status(500).json({ error: 'Error creating script' })
  }
})

// PATCH /api/scripts/:id
router.patch('/:id', isAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!
    const { title, content, notes, status } = req.body

    const existing = await prisma.script.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Not found' })

    const data: any = { updatedBy: { connect: { id: userId } } }
    if (title   !== undefined) data.title   = title
    if (content !== undefined) data.content = content
    if (notes   !== undefined) data.notes   = notes
    if (status  !== undefined) data.status  = status

    const script = await prisma.script.update({
      where: { id: req.params.id },
      data,
      include: SCRIPT_INCLUDE,
    })
    res.json(script)
  } catch (e: any) {
    console.error('[scripts PATCH]', e?.message)
    res.status(500).json({ error: 'Error updating script' })
  }
})

// POST /api/scripts/:id/versions
router.post('/:id/versions', isAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!
    const { notes } = req.body

    const script = await prisma.script.findUnique({ where: { id: req.params.id } })
    if (!script) return res.status(404).json({ error: 'Not found' })

    const last = await prisma.scriptVersion.findFirst({
      where: { scriptId: req.params.id },
      orderBy: { version: 'desc' },
    })
    const nextVersion = (last?.version ?? 0) + 1

    const version = await prisma.scriptVersion.create({
      data: {
        script:   { connect: { id: req.params.id } },
        version:  nextVersion,
        title:    script.title,
        content:  script.content as any,
        notes:    notes ?? null,
        savedBy:  { connect: { id: userId } },
      },
      include: { savedBy: { select: { id: true, name: true, avatarUrl: true } } },
    })
    res.status(201).json(version)
  } catch (e: any) {
    console.error('[scripts versions POST]', e?.message)
    res.status(500).json({ error: 'Error saving version' })
  }
})

// POST /api/scripts/:id/versions/:versionId/restore
router.post('/:id/versions/:versionId/restore', isAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!
    const ver = await prisma.scriptVersion.findUnique({ where: { id: req.params.versionId } })
    if (!ver || ver.scriptId !== req.params.id) return res.status(404).json({ error: 'Not found' })

    const script = await prisma.script.update({
      where: { id: req.params.id },
      data: {
        content:   ver.content as any,
        title:     ver.title,
        updatedBy: { connect: { id: userId } },
      },
      include: SCRIPT_INCLUDE,
    })
    res.json(script)
  } catch (e: any) {
    console.error('[scripts restore]', e?.message)
    res.status(500).json({ error: 'Error restoring version' })
  }
})

// GET /api/scripts/:id/comments
router.get('/:id/comments', isAuth, async (req: Request, res: Response) => {
  try {
    const comments = await prisma.scriptComment.findMany({
      where: { scriptId: req.params.id, parentId: null },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        replies: {
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(comments)
  } catch (e) {
    res.status(500).json({ error: 'Error loading comments' })
  }
})

// POST /api/scripts/:id/comments
router.post('/:id/comments', isAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!
    const { content, parentId, sceneIndex } = req.body
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' })

    const comment = await prisma.scriptComment.create({
      data: {
        script:     { connect: { id: req.params.id } },
        author:     { connect: { id: userId } },
        content:    content.trim(),
        parentId:   parentId ?? null,
        sceneIndex: sceneIndex ?? null,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        replies: {
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    })
    res.status(201).json(comment)
  } catch (e: any) {
    console.error('[scripts comments POST]', e?.message)
    res.status(500).json({ error: 'Error creating comment' })
  }
})

// PATCH /api/scripts/:id/comments/:commentId/resolve
router.patch('/:id/comments/:commentId/resolve', isAuth, async (req: Request, res: Response) => {
  try {
    const comment = await prisma.scriptComment.update({
      where: { id: req.params.commentId },
      data: { isResolved: true },
    })
    res.json(comment)
  } catch (e) {
    res.status(500).json({ error: 'Error resolving comment' })
  }
})

// DELETE /api/scripts/:id — admin only
router.delete('/:id', isAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.script.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Error deleting script' })
  }
})

export default router
