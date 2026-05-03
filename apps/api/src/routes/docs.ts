import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth } from '../middleware/auth'
import { v4 as uuidv4 } from 'uuid'

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
    const where: Record<string, unknown> = { isTemplate: false }
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
      where: { contextType, isTemplate: true },
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
    const [total, byStatus, recentPages, recentVersions] = await Promise.all([
      prisma.docPage.count({ where: { contextType, contextId, isTemplate: false } }),
      prisma.docPage.groupBy({
        by: ['pageStatus'],
        where: { contextType, contextId, isTemplate: false },
        _count: true,
      }),
      prisma.docPage.findMany({
        where: { contextType, contextId, isTemplate: false },
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
    const page = await prisma.docPage.findUnique({
      where: { id: req.params.id },
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
      where: { parentId: req.params.id },
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
      },
      select: { ...PAGE_SELECT, content: true },
    })
    res.status(201).json({ ...page, isFavorite: false })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al crear sub-página' })
  }
})

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
      select: { id: true, updatedAt: true },
    })
    res.json(page)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al guardar' })
  }
})

// ── PATCH /api/docs/pages/:id/meta ───────────────────────────────────────────

docsRouter.patch('/pages/:id/meta', isAuth, async (req, res) => {
  const { title, icon, cover } = req.body
  try {
    const data: Record<string, unknown> = { updatedById: req.user!.userId }
    if (title !== undefined) data.title = title || 'Sin título'
    if (icon  !== undefined) data.icon  = icon  || null
    if (cover !== undefined) data.cover = cover || null

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

// ── GET /api/docs/:contextType/:contextId — page tree (MUST be last GET) ─────

docsRouter.get('/:contextType/:contextId', isAuth, async (req, res) => {
  const { contextType, contextId } = req.params
  if (!VALID_CONTEXT_TYPES.includes(contextType)) {
    res.status(400).json({ error: 'contextType inválido' }); return
  }
  try {
    const pages = await prisma.docPage.findMany({
      where: { contextType, contextId },
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
      },
      select: { ...PAGE_SELECT, content: true },
    })
    res.status(201).json({ ...page, isFavorite: false })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al crear página' })
  }
})
