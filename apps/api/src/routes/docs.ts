import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, requirePermission } from '../middleware/auth'
import { v4 as uuidv4 } from 'uuid'
import { createNotification } from '../lib/notify'
import multer from 'multer'
import pdfParse from 'pdf-parse'
import puppeteer from 'puppeteer'
import { getOrgId } from '../lib/orgContext'

export const docsRouter = Router()

const VALID_CONTEXT_TYPES = ['teamspace', 'client', 'workspace']

const PAGE_SELECT = {
  id: true,
  title: true,
  icon: true,
  cover: true,
  parentId: true,
  contextType: true,
  contextId: true,
  sortOrder: true,
  isPublished: true,
  pageStatus: true,
  isTemplate: true,
  templateName: true,
  templateDesc: true,
  approvedById: true,
  approvedAt: true,
  fullWidth: true,
  createdAt: true,
  updatedAt: true,
  createdBy:  { select: { id: true, name: true } },
  updatedBy:  { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
}

// ── Build page tree (recursive) ───────────────────────────────────────────────

type PageRow = {
  id: string; title: string; icon: string | null; parentId: string | null
  sortOrder: number; isPublished: boolean; pageStatus: string; isTemplate: boolean
}

function buildTree(pages: PageRow[], parentId: string | null = null): (PageRow & { children: ReturnType<typeof buildTree> })[] {
  return pages
    .filter(p => p.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(p => ({ ...p, children: buildTree(pages, p.id) }))
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: Specific routes must come BEFORE generic /:contextType/:contextId
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /api/docs/search ─────────────────────────────────────────────────────

docsRouter.get('/search', isAuth, async (req, res) => {
  const { q, contextType, contextId } = req.query as Record<string, string>
  if (!q || q.trim().length < 2) { res.json([]); return }
  try {
    const where: Record<string, unknown> = { isTemplate: false, organizationId: getOrgId(req) }
    if (contextType) where.contextType = contextType
    if (contextId)   where.contextId   = contextId

    const pages = await prisma.docPage.findMany({
      where: {
        ...where,
        OR: [{ title: { contains: q, mode: 'insensitive' } }],
      },
      select: { id: true, title: true, icon: true, contextType: true, contextId: true, pageStatus: true },
      take: 20,
    })
    res.json(pages)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error en búsqueda' })
  }
})

// ── GET /api/docs/favorites — user's favorite pages ──────────────────────────

docsRouter.get('/favorites', isAuth, async (req, res) => {
  try {
    const favs = await prisma.docFavorite.findMany({
      where: { userId: req.user!.userId },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        sortOrder: true,
        page: {
          select: {
            id: true, title: true, icon: true,
            contextType: true, contextId: true,
            pageStatus: true, isPublished: true,
          },
        },
      },
    })
    res.json(favs)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al cargar favoritos' })
  }
})

// ── POST /api/docs/favorites/:pageId ─────────────────────────────────────────

docsRouter.post('/favorites/:pageId', isAuth, async (req, res) => {
  try {
    const page = await prisma.docPage.findUnique({ where: { id: req.params.pageId }, select: { id: true } })
    if (!page) { res.status(404).json({ error: 'Página no encontrada' }); return }

    const maxSort = await prisma.docFavorite.aggregate({
      where: { userId: req.user!.userId },
      _max: { sortOrder: true },
    })
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1

    await prisma.docFavorite.upsert({
      where: { userId_pageId: { userId: req.user!.userId, pageId: req.params.pageId } },
      create: { userId: req.user!.userId, pageId: req.params.pageId, sortOrder },
      update: {},
    })
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al agregar favorito' })
  }
})

// ── DELETE /api/docs/favorites/:pageId ───────────────────────────────────────

docsRouter.delete('/favorites/:pageId', isAuth, async (req, res) => {
  try {
    await prisma.docFavorite.deleteMany({
      where: { userId: req.user!.userId, pageId: req.params.pageId },
    })
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al eliminar favorito' })
  }
})

// ── GET /api/docs/templates/:contextType — list templates ─────────────────────

docsRouter.get('/templates/:contextType', isAuth, async (req, res) => {
  const { contextType } = req.params
  try {
    const templates = await prisma.docPage.findMany({
      where: { contextType, isTemplate: true, organizationId: getOrgId(req) },
      select: {
        id: true, title: true, icon: true, templateName: true, templateDesc: true,
        contextType: true, contextId: true, createdAt: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(templates)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al cargar templates' })
  }
})

// ── GET /api/docs/home/:contextType/:contextId ────────────────────────────────

docsRouter.get('/home/:contextType/:contextId', isAuth, async (req, res) => {
  const { contextType, contextId } = req.params
  try {
    const orgId = getOrgId(req)
    const [total, byStatus, recentPages, recentVersions] = await Promise.all([
      prisma.docPage.count({ where: { contextType, contextId, isTemplate: false, organizationId: orgId } }),
      prisma.docPage.groupBy({
        by: ['pageStatus'],
        where: { contextType, contextId, isTemplate: false, organizationId: orgId },
        _count: true,
      }),
      prisma.docPage.findMany({
        where: { contextType, contextId, isTemplate: false, organizationId: orgId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true, title: true, icon: true, pageStatus: true, updatedAt: true,
          updatedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.docPageVersion.findMany({
        where: { page: { contextType, contextId } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true, version: true, createdAt: true,
          savedBy: { select: { id: true, name: true } },
          page: { select: { id: true, title: true, icon: true } },
        },
      }),
    ])

    const statusMap: Record<string, number> = {}
    byStatus.forEach(s => { statusMap[s.pageStatus] = s._count })

    res.json({ total, statusMap, recentPages, recentVersions })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al cargar home' })
  }
})

// ── GET /api/docs/pages/:id ───────────────────────────────────────────────────

docsRouter.get('/pages/:id', isAuth, async (req, res) => {
  try {
    const page = await prisma.docPage.findFirst({
      where: { id: req.params.id, organizationId: getOrgId(req) },
      select: { ...PAGE_SELECT, content: true },
    })
    if (!page) { res.status(404).json({ error: 'Página no encontrada' }); return }

    // Is this page a favorite of the current user?
    const fav = await prisma.docFavorite.findUnique({
      where: { userId_pageId: { userId: req.user!.userId, pageId: req.params.id } },
      select: { id: true },
    })

    res.json({ ...page, isFavorite: !!fav })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al cargar página' })
  }
})

// ── GET /api/docs/pages/:id/children ─────────────────────────────────────────

docsRouter.get('/pages/:id/children', isAuth, async (req, res) => {
  try {
    const children = await prisma.docPage.findMany({
      where: { parentId: req.params.id, organizationId: getOrgId(req) },
      select: {
        id: true, title: true, icon: true, parentId: true,
        sortOrder: true, isPublished: true, pageStatus: true, isTemplate: true,
      },
      orderBy: { sortOrder: 'asc' },
    })
    res.json(children)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al cargar sub-páginas' })
  }
})

// ── GET /api/docs/pages/:id/versions ─────────────────────────────────────────

docsRouter.get('/pages/:id/versions', isAuth, async (req, res) => {
  try {
    const versions = await prisma.docPageVersion.findMany({
      where: { pageId: req.params.id },
      select: {
        id: true, version: true, createdAt: true,
        savedBy: { select: { id: true, name: true } },
      },
      orderBy: { version: 'desc' },
      take: 50,
    })
    res.json(versions)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al cargar versiones' })
  }
})

// ── GET /api/docs/versions/:versionId/content ────────────────────────────────

docsRouter.get('/versions/:versionId/content', isAuth, async (req, res) => {
  try {
    const version = await prisma.docPageVersion.findUnique({
      where: { id: req.params.versionId },
      select: { id: true, version: true, content: true, createdAt: true,
        savedBy: { select: { id: true, name: true } },
      },
    })
    if (!version) { res.status(404).json({ error: 'Versión no encontrada' }); return }
    res.json(version)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al cargar versión' })
  }
})

// ── POST /api/docs/pages/:id/versions/restore ────────────────────────────────

docsRouter.post('/pages/:id/versions/restore', isAuth, async (req, res) => {
  const { versionId } = req.body
  if (!versionId) { res.status(400).json({ error: 'versionId requerido' }); return }
  try {
    const version = await prisma.docPageVersion.findUnique({
      where: { id: versionId },
      select: { content: true, version: true },
    })
    if (!version) { res.status(404).json({ error: 'Versión no encontrada' }); return }

    // Save current as a new version before restoring
    await saveVersion(req.params.id, req.user!.userId)

    const page = await prisma.docPage.update({
      where: { id: req.params.id },
      data: { content: version.content as object[], updatedById: req.user!.userId },
      select: { id: true, updatedAt: true },
    })
    res.json(page)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al restaurar versión' })
  }
})

// ── POST /api/docs/pages/:id/children — create child page ────────────────────

docsRouter.post('/pages/:id/children', isAuth, async (req, res) => {
  const { title, icon } = req.body
  try {
    const parent = await prisma.docPage.findUnique({
      where: { id: req.params.id },
      select: { contextType: true, contextId: true },
    })
    if (!parent) { res.status(404).json({ error: 'Página padre no encontrada' }); return }

    const maxSort = await prisma.docPage.aggregate({
      where: { parentId: req.params.id },
      _max: { sortOrder: true },
    })
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1

    const page = await prisma.docPage.create({
      data: {
        title: title || 'Sin título',
        icon: icon || null,
        parentId: req.params.id,
        contextType: parent.contextType,
        contextId: parent.contextId,
        sortOrder,
        content: [{ id: uuidv4(), type: 'paragraph', content: { html: '' } }],
        createdById: req.user!.userId,
        organizationId: getOrgId(req),
      },
      select: { ...PAGE_SELECT, content: true },
    })
    res.status(201).json({ ...page, isFavorite: false })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al crear sub-página' })
  }
})

// ── Mention extraction helper ─────────────────────────────────────────────────

type BlockLike = { content?: { html?: string; items?: string[] } }

function extractDocMentionIds(blocks: BlockLike[]): string[] {
  const re = /data-user-id="([^"]+)"/g
  const ids = new Set<string>()
  for (const block of blocks) {
    const sources: string[] = []
    if (block.content?.html)                       sources.push(block.content.html)
    if (Array.isArray(block.content?.items))       sources.push(...block.content.items)
    for (const src of sources) {
      let m: RegExpExecArray | null
      const local = new RegExp(re.source, 'g')
      while ((m = local.exec(src)) !== null) ids.add(m[1])
    }
  }
  return [...ids]
}

// ── PUT /api/docs/pages/:id — save content (autosave + version snapshot) ─────

const VERSION_DEBOUNCE_MS = 5 * 60 * 1000 // 5 minutes

async function saveVersion(pageId: string, userId: string) {
  try {
    const page = await prisma.docPage.findUnique({
      where: { id: pageId },
      select: { content: true },
    })
    if (!page) return

    // Check if a version was saved recently (debounce)
    const lastVersion = await prisma.docPageVersion.findFirst({
      where: { pageId },
      orderBy: { version: 'desc' },
      select: { version: true, createdAt: true, savedById: true },
    })

    const now = Date.now()
    const recentlySaved =
      lastVersion &&
      now - lastVersion.createdAt.getTime() < VERSION_DEBOUNCE_MS &&
      lastVersion.savedById === userId

    if (!recentlySaved) {
      const nextVersion = (lastVersion?.version ?? 0) + 1

      // Enforce max 50 versions — delete oldest if over limit
      const count = await prisma.docPageVersion.count({ where: { pageId } })
      if (count >= 50) {
        const oldest = await prisma.docPageVersion.findFirst({
          where: { pageId },
          orderBy: { version: 'asc' },
          select: { id: true },
        })
        if (oldest) await prisma.docPageVersion.delete({ where: { id: oldest.id } })
      }

      await prisma.docPageVersion.create({
        data: {
          pageId,
          version: nextVersion,
          content: page.content as object[],
          savedById: userId,
        },
      })
    }
  } catch (e) {
    console.error('Error saving version:', e)
  }
}

docsRouter.put('/pages/:id', isAuth, async (req, res) => {
  const { content } = req.body
  if (!Array.isArray(content)) { res.status(400).json({ error: 'content debe ser un array' }); return }
  try {
    // Save version snapshot (debounced)
    await saveVersion(req.params.id, req.user!.userId)

    const page = await prisma.docPage.update({
      where: { id: req.params.id },
      data: { content, updatedById: req.user!.userId },
      select: { id: true, title: true, updatedAt: true },
    })
    res.json(page)

    // Fire-and-forget: process mentions without blocking autosave response
    ;(async () => {
      const actorId    = req.user!.userId
      const pageId     = req.params.id
      const mentionedIds = extractDocMentionIds(content as BlockLike[])

      const existing    = await prisma.docMention.findMany({ where: { pageId } })
      const existingSet = new Set(existing.map((m: { userId: string }) => m.userId))
      const mentionedSet = new Set(mentionedIds)

      const newIds     = mentionedIds.filter(id => !existingSet.has(id) && id !== actorId)
      const removedIds = [...existingSet].filter(id => !mentionedSet.has(id))

      if (newIds.length > 0) {
        const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { name: true } })
        await Promise.all([
          ...newIds.map(userId =>
            createNotification({
              userId,
              type: 'doc_mention',
              title: 'Te mencionaron en un documento',
              body: `${actor?.name ?? 'Alguien'} te mencionó en "${page.title || 'Sin título'}"`,
              link: `/docs/${pageId}`,
            }).catch(console.error)
          ),
          prisma.docMention.createMany({
            data: newIds.map(userId => ({ pageId, userId })),
            skipDuplicates: true,
          }),
        ])
      }

      if (removedIds.length > 0) {
        await prisma.docMention.deleteMany({
          where: { pageId, userId: { in: removedIds } },
        })
      }
    })().catch(console.error)

  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al guardar' })
  }
})

// ── PATCH /api/docs/pages/:id/meta ───────────────────────────────────────────

docsRouter.patch('/pages/:id/meta', isAuth, async (req, res) => {
  const { title, icon, cover, fullWidth } = req.body
  try {
    const data: Record<string, unknown> = { updatedById: req.user!.userId }
    if (title     !== undefined) data.title     = title || 'Sin título'
    if (icon      !== undefined) data.icon      = icon  || null
    if (cover     !== undefined) data.cover     = cover || null
    if (fullWidth !== undefined) data.fullWidth = Boolean(fullWidth)

    const page = await prisma.docPage.update({
      where: { id: req.params.id },
      data,
      select: PAGE_SELECT,
    })
    res.json(page)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al actualizar metadatos' })
  }
})

// ── PATCH /api/docs/pages/:id/status ─────────────────────────────────────────

docsRouter.patch('/pages/:id/status', isAuth, async (req, res) => {
  const { pageStatus } = req.body
  const VALID_STATUSES = ['borrador', 'en_revision', 'aprobado', 'archivado']
  if (!VALID_STATUSES.includes(pageStatus)) {
    res.status(400).json({ error: 'Estado inválido' }); return
  }
  try {
    const data: Record<string, unknown> = { pageStatus, updatedById: req.user!.userId }
    if (pageStatus === 'aprobado') {
      data.approvedById = req.user!.userId
      data.approvedAt   = new Date()
    } else {
      data.approvedById = null
      data.approvedAt   = null
    }

    const page = await prisma.docPage.update({
      where: { id: req.params.id },
      data,
      select: PAGE_SELECT,
    })
    res.json(page)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al cambiar estado' })
  }
})

// ── PATCH /api/docs/pages/:id/template — toggle template ────────────────────

docsRouter.patch('/pages/:id/template', isAuth, async (req, res) => {
  const { isTemplate, templateName, templateDesc } = req.body
  try {
    const page = await prisma.docPage.update({
      where: { id: req.params.id },
      data: {
        isTemplate: !!isTemplate,
        templateName: isTemplate ? (templateName || null) : null,
        templateDesc: isTemplate ? (templateDesc || null) : null,
        updatedById: req.user!.userId,
      },
      select: PAGE_SELECT,
    })
    res.json(page)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al actualizar template' })
  }
})

// ── POST /api/docs/templates/apply — create page from template ───────────────

docsRouter.post('/templates/apply', isAuth, async (req, res) => {
  const { templateId, contextType, contextId, parentId, title } = req.body
  if (!templateId || !contextType || !contextId) {
    res.status(400).json({ error: 'templateId, contextType y contextId son requeridos' }); return
  }
  try {
    const template = await prisma.docPage.findUnique({
      where: { id: templateId, isTemplate: true },
      select: { content: true, contextType: true },
    })
    if (!template) { res.status(404).json({ error: 'Template no encontrado' }); return }

    const maxSort = await prisma.docPage.aggregate({
      where: { contextType, contextId, parentId: parentId ?? null },
      _max: { sortOrder: true },
    })
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1

    const page = await prisma.docPage.create({
      data: {
        title: title || 'Sin título',
        contextType,
        contextId,
        parentId: parentId ?? null,
        sortOrder,
        content: template.content as object[],
        createdById: req.user!.userId,
        organizationId: getOrgId(req),
      },
      select: { ...PAGE_SELECT, content: true },
    })
    res.status(201).json({ ...page, isFavorite: false })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al aplicar template' })
  }
})

// ── PATCH /api/docs/pages/:id/move ───────────────────────────────────────────

docsRouter.patch('/pages/:id/move', isAuth, async (req, res) => {
  const { parentId, sortOrder } = req.body
  try {
    const page = await prisma.docPage.update({
      where: { id: req.params.id },
      data: {
        parentId: parentId ?? null,
        sortOrder: sortOrder ?? 0,
        updatedById: req.user!.userId,
      },
      select: PAGE_SELECT,
    })
    res.json(page)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al mover página' })
  }
})

// ── DELETE /api/docs/pages/:id ────────────────────────────────────────────────

docsRouter.delete('/pages/:id', isAuth, async (req, res) => {
  const { role } = req.user!
  try {
    const page = await prisma.docPage.findUnique({
      where: { id: req.params.id },
      select: { _count: { select: { children: true } } },
    })
    if (!page) { res.status(404).json({ error: 'Página no encontrada' }); return }

    if (page._count.children > 0 && role !== 'ADMIN') {
      res.status(403).json({ error: 'Solo un administrador puede eliminar páginas con sub-páginas' }); return
    }

    await prisma.docPage.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al eliminar página' })
  }
})

// ── GET /api/docs/public/:token — fetch shared page (no auth, MUST be before generic) ─
docsRouter.get('/public/:token', async (req, res) => {
  const share = await prisma.docPageShare.findUnique({ where: { token: req.params.token } })
  if (!share) { res.status(404).json({ error: 'Enlace no válido' }); return }
  if (share.expiresAt && share.expiresAt < new Date()) { res.status(410).json({ error: 'Este enlace ha expirado' }); return }
  const page = await prisma.docPage.findUnique({
    where:  { id: share.pageId },
    select: { id: true, title: true, icon: true, content: true, fullWidth: true, createdAt: true, updatedAt: true },
  })
  if (!page) { res.status(404).json({ error: 'Página no encontrada' }); return }
  res.json({ ...page, allowComments: share.allowComments, shareToken: share.token })
})

// ── GET /api/docs/:contextType/:contextId — page tree (MUST be last GET) ─────

docsRouter.get('/:contextType/:contextId', isAuth, async (req, res) => {
  const { contextType, contextId } = req.params
  if (!VALID_CONTEXT_TYPES.includes(contextType)) {
    res.status(400).json({ error: 'contextType inválido' }); return
  }
  try {
    const pages = await prisma.docPage.findMany({
      where: { contextType, contextId, organizationId: getOrgId(req) },
      select: {
        id: true, title: true, icon: true, parentId: true,
        sortOrder: true, isPublished: true, pageStatus: true, isTemplate: true,
      },
      orderBy: { sortOrder: 'asc' },
    })
    res.json(buildTree(pages as PageRow[]))
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al cargar páginas' })
  }
})

// ── PDF helpers ───────────────────────────────────────────────────────────────

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => { cb(null, file.mimetype === 'application/pdf') },
})

function pdfToBlocks(text: string): object[] {
  const blocks: object[] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()
    i++
    if (!line) continue

    const nextLine = (lines[i] ?? '').trim()

    // All-caps short line → heading (common in PDFs for section titles)
    const isAllCaps = line === line.toUpperCase() && line.length >= 3 && /[A-Z]/.test(line) && line.length < 100
    // Short line not ending in sentence-terminal punctuation, followed by blank or longer line
    const isShortTitle = line.length < 80 &&
      !line.endsWith('.') && !line.endsWith(',') && !line.endsWith(';') && !line.endsWith(':') &&
      (nextLine === '' || nextLine.length > line.length) &&
      line.split(' ').length <= 10

    if (isAllCaps || isShortTitle) {
      blocks.push({ id: uuidv4(), type: 'heading_2', content: { html: mdInlineToHtml(line) } })
      continue
    }

    // Bullet patterns: -, *, •, –, ·
    if (/^[-*•–·]\s+/.test(line)) {
      const text = mdInlineToHtml(line.replace(/^[-*•–·]\s+/, ''))
      // Merge consecutive bullets into one block
      const prev = blocks[blocks.length - 1] as any
      if (prev?.type === 'bulleted_list') {
        prev.content.items.push(text)
      } else {
        blocks.push({ id: uuidv4(), type: 'bulleted_list', content: { items: [text] } })
      }
      continue
    }

    // Numbered list: "1. " "2) "
    if (/^\d+[\.\)]\s+/.test(line)) {
      const text = mdInlineToHtml(line.replace(/^\d+[\.\)]\s+/, ''))
      const prev = blocks[blocks.length - 1] as any
      if (prev?.type === 'numbered_list') {
        prev.content.items.push(text)
      } else {
        blocks.push({ id: uuidv4(), type: 'numbered_list', content: { items: [text] } })
      }
      continue
    }

    // Paragraph — merge with previous paragraph if no blank line between
    const html = mdInlineToHtml(line)
    const prev = blocks[blocks.length - 1] as any
    if (prev?.type === 'paragraph' && nextLine !== '') {
      prev.content.html += ' ' + html
    } else {
      blocks.push({ id: uuidv4(), type: 'paragraph', content: { html } })
    }
  }

  if (blocks.length === 0) blocks.push({ id: uuidv4(), type: 'paragraph', content: { html: '' } })
  return blocks
}

// ── POST /api/docs/import — import pages from Notion export ──────────────────

function mdInlineToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // strip links, keep label
}

function parseMarkdownToBlocks(md: string): object[] {
  const lines = md.split('\n')
  const blocks: object[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Headings
    if (/^#{1} /.test(trimmed)) {
      blocks.push({ id: uuidv4(), type: 'heading_1', content: { html: mdInlineToHtml(trimmed.slice(2).trim()) } })
      i++; continue
    }
    if (/^#{2} /.test(trimmed)) {
      blocks.push({ id: uuidv4(), type: 'heading_2', content: { html: mdInlineToHtml(trimmed.slice(3).trim()) } })
      i++; continue
    }
    if (/^#{3,} /.test(trimmed)) {
      const level = trimmed.match(/^#+/)![0].length
      blocks.push({ id: uuidv4(), type: 'heading_3', content: { html: mdInlineToHtml(trimmed.slice(level + 1).trim()) } })
      i++; continue
    }

    // Code block
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim() || 'plaintext'
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push({ id: uuidv4(), type: 'code', content: { language: lang, text: codeLines.join('\n') } })
      i++; continue
    }

    // Divider
    if (/^[-*_]{3,}$/.test(trimmed)) {
      blocks.push({ id: uuidv4(), type: 'divider', content: {} })
      i++; continue
    }

    // Blockquote → callout
    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = [trimmed.slice(2)]
      i++
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2))
        i++
      }
      blocks.push({ id: uuidv4(), type: 'callout', content: { icon: '💡', html: mdInlineToHtml(quoteLines.join(' ')) } })
      continue
    }

    // Bulleted list — collect consecutive items
    if (/^[-*+] /.test(trimmed)) {
      const items: string[] = [mdInlineToHtml(trimmed.replace(/^[-*+] /, ''))]
      i++
      while (i < lines.length && /^[-*+] /.test(lines[i].trim())) {
        items.push(mdInlineToHtml(lines[i].trim().replace(/^[-*+] /, '')))
        i++
      }
      blocks.push({ id: uuidv4(), type: 'bulleted_list', content: { items } })
      continue
    }

    // Numbered list
    if (/^\d+\. /.test(trimmed)) {
      const items: string[] = [mdInlineToHtml(trimmed.replace(/^\d+\. /, ''))]
      i++
      while (i < lines.length && /^\d+\. /.test(lines[i].trim())) {
        items.push(mdInlineToHtml(lines[i].trim().replace(/^\d+\. /, '')))
        i++
      }
      blocks.push({ id: uuidv4(), type: 'numbered_list', content: { items } })
      continue
    }

    // Image
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
    if (imgMatch) {
      blocks.push({ id: uuidv4(), type: 'image', content: { url: imgMatch[2], caption: imgMatch[1] } })
      i++; continue
    }

    // Skip empty lines
    if (!trimmed) { i++; continue }

    // Paragraph
    const html = mdInlineToHtml(trimmed)
    if (html) blocks.push({ id: uuidv4(), type: 'paragraph', content: { html } })
    i++
  }

  if (blocks.length === 0) blocks.push({ id: uuidv4(), type: 'paragraph', content: { html: '' } })
  return blocks
}

function parseCsvToBlocks(csv: string): object[] {
  const rows = csv.split('\n').map(l => {
    const cells: string[] = []
    let cur = '', inQuote = false
    for (const ch of l) {
      if (ch === '"') { inQuote = !inQuote; continue }
      if (ch === ',' && !inQuote) { cells.push(cur.trim()); cur = ''; continue }
      cur += ch
    }
    cells.push(cur.trim())
    return cells
  }).filter(r => r.some(c => c))

  if (rows.length === 0) return [{ id: uuidv4(), type: 'paragraph', content: { html: '' } }]

  const headers = rows[0]
  const blocks: object[] = []

  if (rows.length === 1) {
    // Only headers — render as list
    blocks.push({ id: uuidv4(), type: 'bulleted_list', content: { items: headers.filter(Boolean) } })
    return blocks
  }

  for (let r = 1; r < rows.length; r++) {
    if (r > 1) blocks.push({ id: uuidv4(), type: 'divider', content: {} })
    const items = headers.map((h, j) => `${h}: ${rows[r][j] ?? ''}`).filter(Boolean)
    if (items.length) blocks.push({ id: uuidv4(), type: 'bulleted_list', content: { items } })
  }

  return blocks.length ? blocks : [{ id: uuidv4(), type: 'paragraph', content: { html: '' } }]
}

interface ImportItem {
  title: string
  rawContent: string
  format: 'md' | 'csv'
  icon?: string
  parentIndex?: number // index in items array; undefined = root page
}

docsRouter.post('/import', isAuth, async (req, res) => {
  const { contextType, contextId, items } = req.body as {
    contextType: string
    contextId: string
    items: ImportItem[]
  }

  if (!VALID_CONTEXT_TYPES.includes(contextType)) {
    return res.status(400).json({ error: 'contextType inválido' })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No hay páginas para importar' })
  }
  if (items.length > 50) {
    return res.status(400).json({ error: 'Máximo 50 páginas por importación' })
  }

  try {
    const userId = req.user!.userId
    // createdIds[i] = DB id of item i (after creation)
    const createdIds: (string | null)[] = new Array(items.length).fill(null)

    // Get base sortOrder for the context
    const maxSort = await prisma.docPage.aggregate({
      where: { contextType, contextId, parentId: null },
      _max: { sortOrder: true },
    })
    let nextRootSort = (maxSort._max.sortOrder ?? -1) + 1

    // Create root pages first (parentIndex === undefined), then children
    const rootIndices     = items.map((it, i) => ({ it, i })).filter(({ it }) => it.parentIndex === undefined)
    const childrenIndices = items.map((it, i) => ({ it, i })).filter(({ it }) => it.parentIndex !== undefined)

    const MAX_CONTENT_BYTES = 500_000 // 500 KB per page

    for (const { it, i } of rootIndices) {
      if (typeof it.rawContent === 'string' && Buffer.byteLength(it.rawContent, 'utf8') > MAX_CONTENT_BYTES) {
        console.warn(`[docs/import] Item ${i} "${it.title}" excede 500 KB — omitido`)
        continue
      }
      try {
        const content = it.format === 'csv'
          ? parseCsvToBlocks(it.rawContent)
          : parseMarkdownToBlocks(it.rawContent)
        const page = await prisma.docPage.create({
          data: {
            title:       it.title || 'Sin título',
            icon:        it.icon || null,
            contextType,
            contextId,
            sortOrder:   nextRootSort++,
            content:     content as object[],
            createdById: userId,
            organizationId: getOrgId(req),
          },
          select: { id: true },
        })
        createdIds[i] = page.id
      } catch (e) {
        console.error(`[docs/import] Error creando página raíz ${i}:`, e)
      }
    }

    for (const { it, i } of childrenIndices) {
      const parentId = it.parentIndex !== undefined ? createdIds[it.parentIndex] : null
      if (!parentId) continue // parent failed — skip

      if (typeof it.rawContent === 'string' && Buffer.byteLength(it.rawContent, 'utf8') > MAX_CONTENT_BYTES) {
        console.warn(`[docs/import] Item ${i} "${it.title}" excede 500 KB — omitido`)
        continue
      }
      try {
        const childMaxSort = await prisma.docPage.aggregate({
          where: { parentId },
          _max: { sortOrder: true },
        })
        const childSort = (childMaxSort._max.sortOrder ?? -1) + 1

        const content = it.format === 'csv'
          ? parseCsvToBlocks(it.rawContent)
          : parseMarkdownToBlocks(it.rawContent)
        const page = await prisma.docPage.create({
          data: {
            title:       it.title || 'Sin título',
            icon:        it.icon || null,
            contextType,
            contextId,
            parentId,
            sortOrder:   childSort,
            content:     content as object[],
            createdById: userId,
            organizationId: getOrgId(req),
          },
          select: { id: true },
        })
        createdIds[i] = page.id
      } catch (e) {
        console.error(`[docs/import] Error creando subpágina ${i}:`, e)
      }
    }

    const created = items.map((it, i) => ({ title: it.title, id: createdIds[i] })).filter(p => p.id)
    const failed  = items.map((it, i) => ({ title: it.title, id: createdIds[i] })).filter(p => !p.id)
    res.status(failed.length === 0 ? 201 : 207).json({
      created,
      failed,
      firstPageId: created[0]?.id ?? null,
    })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al importar páginas' })
  }
})

// ── POST /api/docs/import-pdf — import single PDF ────────────────────────────

docsRouter.post('/import-pdf', isAuth, pdfUpload.single('file'), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'Archivo PDF requerido' }); return }

  const { contextType, contextId, title } = req.body as Record<string, string>
  if (!VALID_CONTEXT_TYPES.includes(contextType)) {
    res.status(400).json({ error: 'contextType inválido' }); return
  }
  if (!contextId) {
    res.status(400).json({ error: 'contextId requerido' }); return
  }

  let data: Awaited<ReturnType<typeof pdfParse>>
  try {
    data = await pdfParse(req.file.buffer)
  } catch {
    res.status(422).json({ error: 'No se pudo leer el PDF. Verifica que no esté protegido con contraseña.' }); return
  }

  const rawText = data.text ?? ''
  if (!rawText.trim()) {
    res.status(422).json({ error: 'El PDF no contiene texto extraíble. Puede ser un PDF de imágenes o escaneado.' }); return
  }

  const blocks = pdfToBlocks(rawText)
  const pageTitle = title?.trim() ||
    req.file.originalname.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim() ||
    'Documento PDF'

  try {
    const maxSort = await prisma.docPage.aggregate({
      where: { contextType, contextId, parentId: null },
      _max:  { sortOrder: true },
    })

    const page = await prisma.docPage.create({
      data: {
        title:       pageTitle,
        icon:        '📄',
        content:     blocks as object[],
        contextType,
        contextId,
        sortOrder:   (maxSort._max.sortOrder ?? -1) + 1,
        createdById: req.user!.userId,
        organizationId: getOrgId(req),
      },
      select: { id: true, title: true },
    })

    res.status(201).json({
      pageId:      page.id,
      title:       page.title,
      blocksCreated: blocks.length,
      pagesInPdf:  data.numpages,
    })
  } catch (e) {
    console.error('[docs/import-pdf]', e)
    res.status(500).json({ error: 'Error al crear la página' })
  }
})

// ── POST /api/docs/:contextType/:contextId — create root page ─────────────────

docsRouter.post('/:contextType/:contextId', isAuth, async (req, res) => {
  const { contextType, contextId } = req.params
  if (!VALID_CONTEXT_TYPES.includes(contextType)) {
    res.status(400).json({ error: 'contextType inválido' }); return
  }
  const { title, icon } = req.body
  try {
    const maxSort = await prisma.docPage.aggregate({
      where: { contextType, contextId, parentId: null },
      _max: { sortOrder: true },
    })
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1

    const page = await prisma.docPage.create({
      data: {
        title: title || 'Sin título',
        icon: icon || null,
        contextType,
        contextId,
        sortOrder,
        content: [{ id: uuidv4(), type: 'paragraph', content: { html: '' } }],
        createdById: req.user!.userId,
        organizationId: getOrgId(req),
      },
      select: { ...PAGE_SELECT, content: true },
    })
    res.status(201).json({ ...page, isFavorite: false })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al crear página' })
  }
})

// ═══════════════════════════════════════════════════════════════════════
// PHASE 1: Duplicate page + Export
// ═══════════════════════════════════════════════════════════════════════

// ── POST /pages/:id/duplicate ─────────────────────────────────────────
docsRouter.post('/pages/:id/duplicate', isAuth, async (req, res) => {
  const src = await prisma.docPage.findUnique({
    where: { id: req.params.id },
    include: { children: { orderBy: { sortOrder: 'asc' }, include: { children: true } } },
  })
  if (!src) { res.status(404).json({ error: 'Página no encontrada' }); return }

  async function copyPage(orig: typeof src, parentId: string | null, sortOffset: number) {
    const maxSort = await prisma.docPage.aggregate({
      where: { contextType: orig.contextType, contextId: orig.contextId, parentId },
      _max: { sortOrder: true },
    })
    const page = await prisma.docPage.create({
      data: {
        title:       `Copia de ${orig.title}`,
        icon:        orig.icon,
        cover:       orig.cover,
        contextType: orig.contextType,
        contextId:   orig.contextId,
        parentId,
        sortOrder:   (maxSort._max.sortOrder ?? -1) + 1 + sortOffset,
        content:     orig.content as object[],
        fullWidth:   orig.fullWidth,
        createdById: req.user!.userId,
      },
      select: { id: true, title: true },
    })
    return page
  }

  const copy = await copyPage(src, src.parentId, 1)

  // Recurse children
  for (const child of (src as any).children ?? []) {
    await copyPage({ ...child } as typeof src, copy.id, 0)
  }

  res.status(201).json({ pageId: copy.id, title: copy.title })
})

// ── PDF export helpers ────────────────────────────────────────────────
function escHtmlPdf(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function blocksToHtml(blocks: any[]): string {
  function blockHtml(b: any): string {
    const c = b.content ?? {}
    switch (b.type) {
      case 'heading_1': return `<h1>${c.html ?? ''}</h1>`
      case 'heading_2': return `<h2>${c.html ?? ''}</h2>`
      case 'heading_3': return `<h3>${c.html ?? ''}</h3>`
      case 'paragraph': return `<p>${c.html ?? ''}</p>`
      case 'quote':     return `<blockquote>${c.html ?? ''}</blockquote>`
      case 'callout':   return `<div class="callout"><span class="callout-icon">${c.icon ?? '💡'}</span><div>${c.html ?? ''}</div></div>`
      case 'divider':   return `<hr/>`
      case 'code':      return `<pre><code class="language-${c.language ?? ''}">${escHtmlPdf(c.text ?? '')}</code></pre>`
      case 'bulleted_list': return `<ul>${(c.items ?? []).map((i: string) => `<li>${i}</li>`).join('')}</ul>`
      case 'numbered_list': return `<ol>${(c.items ?? []).map((i: string) => `<li>${i}</li>`).join('')}</ol>`
      case 'toggle':    return `<div class="toggle"><div class="toggle-header">${c.html ?? ''}</div><div class="toggle-body">${(c.children ?? []).map(blockHtml).join('')}</div></div>`
      case 'image':     return c.url ? `<figure><img src="${c.url}" alt="${c.caption ?? ''}"/>${c.caption ? `<figcaption>${c.caption}</figcaption>` : ''}</figure>` : ''
      case 'video':     return c.url ? `<div class="media-note">▶ Video: <a href="${c.url}">${c.url}</a></div>` : ''
      case 'embed':     return c.url ? `<div class="media-note">⊕ ${c.service ?? 'Embed'}: <a href="${c.url}">${c.url}</a></div>` : ''
      case 'child_page': return `<div class="child-page">${c.pageIcon ?? '📄'} ${c.title ?? ''}</div>`
      case 'table': {
        const headers: string[] = c.headers ?? []
        const rows: string[][] = c.rows ?? []
        return `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r: string[]) => `<tr>${r.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      }
      default: return ''
    }
  }
  return blocks.map(blockHtml).join('\n')
}

function buildPdfHtml(title: string, icon: string | null, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/>
<style>
  @page { size: A4; margin: 2.2cm 2.5cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.7; color: #1a1a1a; }
  h1 { font-size: 24pt; font-weight: 700; margin: 0 0 6pt; }
  h2 { font-size: 16pt; font-weight: 600; margin: 18pt 0 6pt; border-bottom: 1px solid #e5e7eb; padding-bottom: 4pt; }
  h3 { font-size: 13pt; font-weight: 600; margin: 14pt 0 4pt; }
  p  { margin: 0 0 8pt; }
  ul, ol { padding-left: 1.4em; margin: 0 0 8pt; }
  li { margin-bottom: 3pt; }
  blockquote { border-left: 3pt solid #94a3b8; padding-left: 12pt; color: #475569; margin: 10pt 0; font-style: italic; }
  pre { background: #f8fafc; border: 1pt solid #e2e8f0; border-radius: 4pt; padding: 8pt 10pt; font-family: 'Courier New', monospace; font-size: 9pt; white-space: pre-wrap; word-break: break-all; margin: 8pt 0; }
  code { font-family: 'Courier New', monospace; background: #f1f5f9; padding: 1pt 3pt; border-radius: 2pt; font-size: 9.5pt; }
  hr { border: none; border-top: 1pt solid #e2e8f0; margin: 14pt 0; }
  table { width: 100%; border-collapse: collapse; margin: 10pt 0; font-size: 10pt; }
  th { background: #f8fafc; font-weight: 600; text-align: left; padding: 5pt 8pt; border: 1pt solid #e2e8f0; }
  td { padding: 5pt 8pt; border: 1pt solid #e2e8f0; vertical-align: top; }
  figure { margin: 10pt 0; text-align: center; }
  img { max-width: 100%; height: auto; border-radius: 4pt; }
  figcaption { font-size: 9pt; color: #64748b; margin-top: 4pt; font-style: italic; }
  .callout { background: #f8fafc; border: 1pt solid #e2e8f0; border-radius: 6pt; padding: 10pt 12pt; margin: 10pt 0; display: flex; gap: 8pt; align-items: flex-start; }
  .callout-icon { font-size: 14pt; line-height: 1.4; flex-shrink: 0; }
  .toggle { margin: 6pt 0; }
  .toggle-header { font-weight: 500; }
  .toggle-body { margin-top: 4pt; border-left: 2pt solid #e2e8f0; padding-left: 10pt; }
  .child-page { background: #f8fafc; border: 1pt solid #e2e8f0; border-radius: 4pt; padding: 6pt 10pt; margin: 6pt 0; font-size: 10pt; color: #475569; }
  .media-note { background: #fefce8; border: 1pt solid #fde68a; border-radius: 4pt; padding: 6pt 10pt; margin: 6pt 0; font-size: 9.5pt; color: #92400e; }
  .doc-title { margin-bottom: 24pt; padding-bottom: 14pt; border-bottom: 2pt solid #1a1a1a; }
  a { color: #4f46e5; }
  h1, h2, h3 { page-break-after: avoid; }
  pre, table, figure { page-break-inside: avoid; }
</style>
</head><body>
<div class="doc-title">
  ${icon ? `<div style="font-size:32pt;margin-bottom:8pt">${icon}</div>` : ''}
  <h1>${title}</h1>
</div>
${bodyHtml}
</body></html>`
}

// ── GET /pages/:id/export?format=md|pdf ──────────────────────────────
docsRouter.get('/pages/:id/export', isAuth, async (req, res) => {
  const page = await prisma.docPage.findUnique({
    where: { id: req.params.id },
    select: { title: true, icon: true, content: true },
  })
  if (!page) { res.status(404).json({ error: 'Página no encontrada' }); return }

  const format = (req.query.format as string) || 'md'
  const blocks = (page.content as any[]) ?? []

  // ── PDF branch ──────────────────────────────────────────────────────
  if (format === 'pdf') {
    const bodyHtml = blocksToHtml(blocks)
    const html = buildPdfHtml(page.title, page.icon ?? null, bodyHtml)
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
    try {
      const tab = await browser.newPage()
      await tab.setContent(html, { waitUntil: 'networkidle0' })
      const pdf = await tab.pdf({ format: 'A4', printBackground: true })
      const safeName = page.title.replace(/[^\w\s\-áéíóúÁÉÍÓÚñÑ]/g, '').trim() || 'documento'
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`)
      res.send(Buffer.from(pdf))
    } catch (e) {
      console.error('[docs/export/pdf]', e)
      res.status(500).json({ error: 'Error generando PDF' })
    } finally {
      await browser.close()
    }
    return
  }

  function blockToMd(b: any): string {
    const html2text = (h: string) => (h ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
    switch (b.type) {
      case 'heading_1':     return `# ${html2text(b.content?.html)}\n`
      case 'heading_2':     return `## ${html2text(b.content?.html)}\n`
      case 'heading_3':     return `### ${html2text(b.content?.html)}\n`
      case 'paragraph':     return `${html2text(b.content?.html)}\n`
      case 'quote':         return `> ${html2text(b.content?.html)}\n`
      case 'callout':       return `> ${b.content?.icon ?? '💡'} ${html2text(b.content?.html)}\n`
      case 'bulleted_list': return (b.content?.items ?? []).map((i: string) => `- ${i}`).join('\n') + '\n'
      case 'numbered_list': return (b.content?.items ?? []).map((i: string, idx: number) => `${idx+1}. ${i}`).join('\n') + '\n'
      case 'divider':       return `---\n`
      case 'code':          return `\`\`\`${b.content?.language ?? ''}\n${b.content?.text ?? ''}\n\`\`\`\n`
      case 'image':         return `![${b.content?.caption ?? ''}](${b.content?.url ?? ''})\n`
      case 'video':         return `[Video](${b.content?.url ?? ''})\n`
      case 'embed':         return `[Embed: ${b.content?.service ?? ''}](${b.content?.url ?? ''})\n`
      case 'toggle':        return `**${html2text(b.content?.html)}**\n${(b.content?.children ?? []).map((c: any) => `  ${blockToMd(c)}`).join('')}`
      case 'table': {
        const headers: string[] = b.content?.headers ?? []
        const rows: string[][] = b.content?.rows ?? []
        const head = `| ${headers.join(' | ')} |`
        const sep  = `| ${headers.map(() => '---').join(' | ')} |`
        const body = rows.map((r: string[]) => `| ${r.join(' | ')} |`).join('\n')
        return `${head}\n${sep}\n${body}\n`
      }
      default: return ''
    }
  }

  const md = `# ${page.title}\n\n${blocks.map(blockToMd).join('\n')}`

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${page.title.replace(/[^a-zA-Z0-9]/g,'-')}.md"`)
  res.send(md)
})

// ═══════════════════════════════════════════════════════════════════════
// PHASE 2: Comments
// ═══════════════════════════════════════════════════════════════════════

const COMMENT_INCLUDE = {
  author: { select: { id: true, name: true, avatarUrl: true } },
  replies: {
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  },
}

// GET /pages/:id/comments
docsRouter.get('/pages/:id/comments', isAuth, async (req, res) => {
  const comments = await prisma.docComment.findMany({
    where: { pageId: req.params.id, parentId: null },
    include: COMMENT_INCLUDE,
    orderBy: { createdAt: 'asc' },
  })
  res.json(comments)
})

// POST /pages/:id/comments
docsRouter.post('/pages/:id/comments', isAuth, async (req, res) => {
  const { content, blockId, parentId } = req.body
  if (!content?.trim()) { res.status(400).json({ error: 'Contenido requerido' }); return }
  const comment = await prisma.docComment.create({
    data: { pageId: req.params.id, content: content.trim(), blockId: blockId || null, parentId: parentId || null, authorId: req.user!.userId },
    include: COMMENT_INCLUDE,
  })
  res.status(201).json(comment)
})

// PATCH /pages/:id/comments/:commentId
docsRouter.patch('/pages/:id/comments/:commentId', isAuth, async (req, res) => {
  const existing = await prisma.docComment.findUnique({ where: { id: req.params.commentId } })
  if (!existing || existing.pageId !== req.params.id) { res.status(404).json({ error: 'Comentario no encontrado' }); return }
  const data: Record<string, unknown> = {}
  if (req.body.content !== undefined) data.content = req.body.content
  if (req.body.resolved !== undefined) data.resolved = req.body.resolved
  const comment = await prisma.docComment.update({ where: { id: req.params.commentId }, data, include: COMMENT_INCLUDE })
  res.json(comment)
})

// DELETE /pages/:id/comments/:commentId
docsRouter.delete('/pages/:id/comments/:commentId', isAuth, async (req, res) => {
  const existing = await prisma.docComment.findUnique({ where: { id: req.params.commentId } })
  if (!existing || existing.pageId !== req.params.id) { res.status(404).json({ error: 'Comentario no encontrado' }); return }
  if (existing.authorId !== req.user!.userId && req.user!.role !== 'ADMIN') { res.status(403).json({ error: 'Sin permiso' }); return }
  await prisma.docComment.delete({ where: { id: req.params.commentId } })
  res.json({ ok: true })
})

// ═══════════════════════════════════════════════════════════════════════
// PHASE 2: Public sharing
// ═══════════════════════════════════════════════════════════════════════

// POST /pages/:id/share — create share link
docsRouter.post('/pages/:id/share', isAuth, async (req, res) => {
  const { allowComments = false, expiresAt } = req.body
  const token = uuidv4().replace(/-/g, '')
  const share = await prisma.docPageShare.create({
    data: {
      pageId: req.params.id,
      token,
      createdById: req.user!.userId,
      allowComments,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  })
  res.status(201).json({ token: share.token, url: `/docs/public/${share.token}` })
})

// GET /pages/:id/shares — list active shares
docsRouter.get('/pages/:id/shares', isAuth, async (req, res) => {
  const shares = await prisma.docPageShare.findMany({
    where: { pageId: req.params.id },
    orderBy: { createdAt: 'desc' },
  })
  res.json(shares)
})

// DELETE /pages/:id/shares/:token — revoke share
docsRouter.delete('/pages/:id/shares/:token', isAuth, async (req, res) => {
  await prisma.docPageShare.deleteMany({ where: { pageId: req.params.id, token: req.params.token } })
  res.json({ ok: true })
})

// ═══════════════════════════════════════════════════════════════════════
// PHASE 2: Backlinks
// ═══════════════════════════════════════════════════════════════════════

// GET /pages/:id/backlinks
docsRouter.get('/pages/:id/backlinks', isAuth, async (req, res) => {
  const links = await prisma.docBacklink.findMany({
    where: { targetId: req.params.id },
    include: { source: { select: { id: true, title: true, icon: true, contextType: true, contextId: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(links.map(l => l.source))
})
