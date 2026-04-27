import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdmin } from '../middleware/auth'

export const teamspacesRouter = Router()

// GET /api/teamspaces
// Admin: all teamspaces + isMember flag
// Others: OPEN + CLOSED (always visible) + PRIVATE only if member
teamspacesRouter.get('/', isAuth, async (req, res) => {
  const { userId, role } = req.user!
  const isAdminUser = role === 'ADMIN'

  try {
    const allTeamspaces = await prisma.teamspace.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        members: { select: { userId: true } },
        projects: {
          where: { status: { not: 'COMPLETED' } },
          orderBy: { createdAt: 'asc' },
          take: 5, // fetch 5, we'll trim to 4 + show "+N" on frontend
          select: {
            id: true,
            name: true,
            status: true,
            estimatedClose: true,
          },
        },
      },
    })

    const result = allTeamspaces
      .filter(ts => {
        if (isAdminUser) return true
        if (ts.visibility === 'PRIVATE') {
          return ts.members.some(m => m.userId === userId)
        }
        return true // OPEN and CLOSED are always visible
      })
      .map(ts => {
        const isMember = ts.members.some(m => m.userId === userId)
        const canSeeProjects = isAdminUser || isMember || ts.visibility === 'OPEN'
        return {
          id: ts.id,
          name: ts.name,
          emoji: ts.emoji,
          visibility: ts.visibility,
          isMember,
          isAdmin: isAdminUser,
          projects: canSeeProjects ? ts.projects : [],
        }
      })

    res.json(result)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al cargar teamspaces' })
  }
})

// POST /api/teamspaces — admin only
teamspacesRouter.post('/', isAdmin, async (req, res) => {
  const { name, emoji, description, visibility } = req.body
  if (!name) { res.status(400).json({ error: 'El nombre es requerido' }); return }
  try {
    const ts = await prisma.teamspace.create({
      data: {
        name,
        emoji: emoji || '🏢',
        description: description || null,
        visibility: visibility || 'OPEN',
        members: { create: { userId: req.user!.userId } }, // creator is member
      },
    })
    res.status(201).json(ts)
  } catch (e) {
    res.status(500).json({ error: 'Error al crear teamspace' })
  }
})

// PATCH /api/teamspaces/:id — admin only
teamspacesRouter.patch('/:id', isAdmin, async (req, res) => {
  const { name, emoji, description, visibility } = req.body
  try {
    const ts = await prisma.teamspace.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(emoji && { emoji }),
        ...(description !== undefined && { description }),
        ...(visibility && { visibility }),
      },
    })
    res.json(ts)
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar teamspace' })
  }
})

// POST /api/teamspaces/:id/members — admin adds member
teamspacesRouter.post('/:id/members', isAdmin, async (req, res) => {
  const { userId } = req.body
  if (!userId) { res.status(400).json({ error: 'userId requerido' }); return }
  try {
    await prisma.teamspaceMember.upsert({
      where: { teamspaceId_userId: { teamspaceId: req.params.id, userId } },
      create: { teamspaceId: req.params.id, userId },
      update: {},
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Error al agregar miembro' })
  }
})

// DELETE /api/teamspaces/:id/members/:userId — admin removes member
teamspacesRouter.delete('/:id/members/:userId', isAdmin, async (req, res) => {
  try {
    await prisma.teamspaceMember.delete({
      where: { teamspaceId_userId: { teamspaceId: req.params.id, userId: req.params.userId } },
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar miembro' })
  }
})
