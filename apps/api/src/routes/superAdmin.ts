import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth } from '../middleware/auth'

export const superAdminRouter = Router()

// ── Super-admin guard ─────────────────────────────────────────────────────────

async function isSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'No autenticado' })
    return
  }
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { isSuperAdmin: true },
  })
  if (!user?.isSuperAdmin) {
    res.status(403).json({ error: 'Acceso denegado' })
    return
  }
  next()
}

// All routes: isAuth then isSuperAdmin
superAdminRouter.use(isAuth, isSuperAdmin)

// ── GET /api/super-admin/stats ────────────────────────────────────────────────

superAdminRouter.get('/stats', async (_req, res) => {
  const [totalOrgs, activeOrgs, trialOrgs, totalUsers, planCounts] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { planStatus: 'ACTIVE' } }),
    prisma.organization.count({ where: { plan: 'TRIAL' } }),
    prisma.user.count(),
    prisma.organization.groupBy({
      by: ['plan'],
      where: { planStatus: 'ACTIVE', plan: { in: ['STARTER', 'GROWTH', 'STUDIO'] } },
      _count: { _all: true },
    }),
  ])

  const priceMap: Record<string, number> = { STARTER: 49, GROWTH: 99, STUDIO: 199 }
  const mrrEstimate = planCounts.reduce((sum, g) => sum + (priceMap[g.plan] ?? 0) * g._count._all, 0)

  res.json({ totalOrgs, activeOrgs, trialOrgs, totalUsers, mrrEstimate })
})

// ── GET /api/super-admin/organizations ───────────────────────────────────────

superAdminRouter.get('/organizations', async (_req, res) => {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      planStatus: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      stripeCustomerId: true,
      maxUsers: true,
      maxClients: true,
      storageGb: true,
      createdAt: true,
      _count: {
        select: {
          members: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Count clients per org separately (Client.organizationId)
  const clientCounts = await prisma.client.groupBy({
    by: ['organizationId'],
    _count: { _all: true },
  })
  const clientCountMap = Object.fromEntries(
    clientCounts
      .filter(c => c.organizationId !== null)
      .map(c => [c.organizationId as string, c._count._all])
  )

  const result = orgs.map(org => ({
    ...org,
    _count: {
      members: org._count.members,
      clients: clientCountMap[org.id] ?? 0,
    },
  }))

  res.json(result)
})

// ── GET /api/super-admin/organizations/:id ───────────────────────────────────

superAdminRouter.get('/organizations/:id', async (req, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      planStatus: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      stripeCustomerId: true,
      maxUsers: true,
      maxClients: true,
      storageGb: true,
      createdAt: true,
      members: {
        select: {
          userId: true,
          role: true,
          joinedAt: true,
          user: {
            select: { id: true, name: true, email: true, status: true },
          },
        },
      },
    },
  })

  if (!org) {
    res.status(404).json({ error: 'Organización no encontrada' })
    return
  }

  const clientCount = await prisma.client.count({ where: { organizationId: req.params.id } })

  res.json({ ...org, _count: { members: org.members.length, clients: clientCount } })
})

// ── PATCH /api/super-admin/organizations/:id ─────────────────────────────────

superAdminRouter.patch('/organizations/:id', async (req, res) => {
  const { plan, planStatus, maxUsers, maxClients, storageGb, trialEndsAt } = req.body

  const updated = await prisma.organization.update({
    where: { id: req.params.id },
    data: {
      ...(plan       !== undefined && { plan }),
      ...(planStatus !== undefined && { planStatus }),
      ...(maxUsers   !== undefined && { maxUsers: Number(maxUsers) }),
      ...(maxClients !== undefined && { maxClients: Number(maxClients) }),
      ...(storageGb  !== undefined && { storageGb: Number(storageGb) }),
      ...(trialEndsAt !== undefined && { trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null }),
    },
    select: {
      id: true, name: true, slug: true, plan: true, planStatus: true,
      trialEndsAt: true, currentPeriodEnd: true, stripeCustomerId: true,
      maxUsers: true, maxClients: true, storageGb: true, createdAt: true,
    },
  })

  res.json(updated)
})

// ── POST /api/super-admin/organizations/:id/suspend ──────────────────────────

superAdminRouter.post('/organizations/:id/suspend', async (req, res) => {
  const org = await prisma.organization.update({
    where: { id: req.params.id },
    data: { planStatus: 'SUSPENDED' },
    select: { id: true, name: true, planStatus: true },
  })
  res.json(org)
})

// ── POST /api/super-admin/organizations/:id/reactivate ───────────────────────

superAdminRouter.post('/organizations/:id/reactivate', async (req, res) => {
  const org = await prisma.organization.update({
    where: { id: req.params.id },
    data: { planStatus: 'ACTIVE' },
    select: { id: true, name: true, planStatus: true },
  })
  res.json(org)
})
