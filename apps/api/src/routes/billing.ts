import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { prisma } from '../lib/prisma'
import { getOrgId } from '../lib/orgContext'
import { isAuth, isAdmin } from '../middleware/auth'

const router = Router()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
})

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

// Plan metadata mapped from Stripe price IDs
interface PlanMeta {
  plan: 'STARTER' | 'GROWTH' | 'STUDIO'
  maxUsers: number
  maxClients: number
  storageGb: number
}

function getPlanMetaByPriceId(priceId: string): PlanMeta | null {
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) {
    return { plan: 'STARTER', maxUsers: 5, maxClients: 10, storageGb: 5 }
  }
  if (priceId === process.env.STRIPE_GROWTH_PRICE_ID) {
    return { plan: 'GROWTH', maxUsers: 15, maxClients: 30, storageGb: 25 }
  }
  if (priceId === process.env.STRIPE_STUDIO_PRICE_ID) {
    return { plan: 'STUDIO', maxUsers: 9999, maxClients: 9999, storageGb: 100 }
  }
  return null
}

// ─── GET / — billing info + usage stats ──────────────────────────────────────
router.get('/', isAuth, isAdmin, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)

    const [org, usersCount, clientsCount] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          plan: true,
          planStatus: true,
          trialEndsAt: true,
          currentPeriodEnd: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          maxUsers: true,
          maxClients: true,
          storageGb: true,
        },
      }),
      prisma.organizationMember.count({ where: { organizationId: orgId } }),
      prisma.client.count({ where: { organizationId: orgId } }),
    ])

    if (!org) {
      res.status(404).json({ error: 'Organización no encontrada' })
      return
    }

    res.json({
      plan: org.plan,
      planStatus: org.planStatus,
      trialEndsAt: org.trialEndsAt,
      currentPeriodEnd: org.currentPeriodEnd,
      limits: {
        maxUsers: org.maxUsers,
        maxClients: org.maxClients,
        storageGb: org.storageGb,
      },
      usage: {
        usersCount,
        clientsCount,
        storageUsedGb: 0,
      },
    })
  } catch (err) {
    console.error('[billing] GET / error:', err)
    res.status(500).json({ error: 'Error al obtener información de facturación' })
  }
})

// ─── POST /checkout — create Stripe Checkout Session ─────────────────────────
router.post('/checkout', isAuth, isAdmin, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { priceId } = req.body as { priceId?: string }

    if (!priceId) {
      res.status(400).json({ error: 'priceId es requerido' })
      return
    }

    const planMeta = getPlanMetaByPriceId(priceId)
    if (!planMeta) {
      res.status(400).json({ error: 'priceId no válido' })
      return
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { stripeCustomerId: true, name: true },
    })

    if (!org) {
      res.status(404).json({ error: 'Organización no encontrada' })
      return
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/settings/billing?success=1`,
      cancel_url: `${process.env.APP_URL}/settings/billing?cancelled=1`,
      metadata: { organizationId: orgId },
    }

    if (org.stripeCustomerId) {
      sessionParams.customer = org.stripeCustomerId
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    res.json({ url: session.url })
  } catch (err) {
    console.error('[billing] POST /checkout error:', err)
    res.status(500).json({ error: 'Error al crear sesión de pago' })
  }
})

// ─── GET /portal — create Stripe Customer Portal session ─────────────────────
router.get('/portal', isAuth, isAdmin, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { stripeCustomerId: true },
    })

    if (!org) {
      res.status(404).json({ error: 'Organización no encontrada' })
      return
    }

    if (!org.stripeCustomerId) {
      res.status(400).json({ error: 'Esta organización no tiene una suscripción activa en Stripe' })
      return
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${process.env.APP_URL}/settings/billing`,
    })

    res.json({ url: portalSession.url })
  } catch (err) {
    console.error('[billing] GET /portal error:', err)
    res.status(500).json({ error: 'Error al abrir el portal de facturación' })
  }
})

// ─── POST /webhook — Stripe webhook handler (raw body, no auth) ───────────────
// IMPORTANT: This route requires the raw request body (Buffer) for Stripe signature
// verification. In index.ts, register this BEFORE express.json():
//   import express from 'express'
//   import billingRouter from './routes/billing'
//   app.use('/api/billing/webhook', express.raw({ type: 'application/json' }), billingRouter)
// Then mount the rest of the billing router normally:
//   app.use('/api/billing', billingRouter)
router.post(
  '/webhook',
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string | undefined

    if (!sig) {
      res.status(400).json({ error: 'Missing stripe-signature header' })
      return
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, WEBHOOK_SECRET)
    } catch (err) {
      console.error('[billing] Webhook signature verification failed:', err)
      res.status(400).json({ error: 'Webhook signature inválida' })
      return
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session

          const organizationId = session.metadata?.organizationId
          if (!organizationId) {
            console.warn('[billing] checkout.session.completed: no organizationId in metadata')
            break
          }

          // Retrieve subscription to get current period end and price ID
          let plan: PlanMeta | null = null
          let currentPeriodEnd: Date | undefined

          if (session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(
              session.subscription as string
            )
            const priceId = subscription.items.data[0]?.price?.id
            if (priceId) plan = getPlanMetaByPriceId(priceId)
            currentPeriodEnd = new Date(subscription.current_period_end * 1000)
          }

          await prisma.organization.update({
            where: { id: organizationId },
            data: {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              planStatus: 'ACTIVE',
              currentPeriodEnd: currentPeriodEnd,
              ...(plan
                ? {
                    plan: plan.plan,
                    maxUsers: plan.maxUsers,
                    maxClients: plan.maxClients,
                    storageGb: plan.storageGb,
                  }
                : {}),
            },
          })

          console.log(`[billing] checkout.session.completed: org ${organizationId} upgraded to ${plan?.plan ?? 'unknown'}`)
          break
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice

          const customerId = invoice.customer as string
          if (!customerId) break

          let currentPeriodEnd: Date | undefined

          // Get current period end from the subscription
          const subscriptionId =
            typeof invoice.subscription === 'string'
              ? invoice.subscription
              : (invoice.subscription as Stripe.Subscription | null)?.id

          if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId)
            currentPeriodEnd = new Date(subscription.current_period_end * 1000)
          }

          await prisma.organization.updateMany({
            where: { stripeCustomerId: customerId },
            data: {
              planStatus: 'ACTIVE',
              ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
            },
          })

          console.log(`[billing] invoice.payment_succeeded: customer ${customerId} renewed`)
          break
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice

          const customerId = invoice.customer as string
          if (!customerId) break

          await prisma.organization.updateMany({
            where: { stripeCustomerId: customerId },
            data: { planStatus: 'PAST_DUE' },
          })

          console.log(`[billing] invoice.payment_failed: customer ${customerId} marked PAST_DUE`)
          break
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription

          const customerId =
            typeof subscription.customer === 'string'
              ? subscription.customer
              : (subscription.customer as Stripe.Customer).id

          await prisma.organization.updateMany({
            where: { stripeCustomerId: customerId },
            data: {
              planStatus: 'CANCELLED',
              plan: 'TRIAL',
            },
          })

          console.log(`[billing] customer.subscription.deleted: customer ${customerId} downgraded to TRIAL`)
          break
        }

        default:
          // Unhandled event type — ignore silently
          break
      }

      res.json({ received: true })
    } catch (err) {
      console.error(`[billing] Error processing webhook event ${event.type}:`, err)
      res.status(500).json({ error: 'Error procesando webhook' })
    }
  }
)

// ─── GET /export — GDPR data export ──────────────────────────────────────────
router.get('/export', isAuth, isAdmin, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)

    const [org, members, clients, projectCount, briefCount, contentPieceCount, taskCount] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          planStatus: true,
          createdAt: true,
        },
      }),
      prisma.organizationMember.findMany({
        where: { organizationId: orgId },
        select: {
          role: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.client.findMany({
        where: { organizationId: orgId },
        select: { name: true },
      }),
      prisma.project.count({ where: { organizationId: orgId } }),
      prisma.contentBrief.count({ where: { organizationId: orgId } }),
      prisma.contentPiece.count({ where: { organizationId: orgId } }),
      prisma.task.count({ where: { organizationId: orgId } }),
    ])

    if (!org) {
      res.status(404).json({ error: 'Organización no encontrada' })
      return
    }

    const exportedAt = new Date().toISOString()
    const dateStr = exportedAt.slice(0, 10)

    res.setHeader('Content-Type', 'application/json')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="processa-export-${org.slug}-${dateStr}.json"`
    )

    res.json({
      exportedAt,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        planStatus: org.planStatus,
        createdAt: org.createdAt,
      },
      summary: {
        members: members.length,
        clients: clients.length,
        projects: projectCount,
        briefs: briefCount,
        contentPieces: contentPieceCount,
        tasks: taskCount,
      },
      members: members.map(m => ({
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        joinedAt: m.createdAt,
      })),
      clients: clients.map(c => ({ name: c.name })),
    })
  } catch (err) {
    console.error('[billing] GET /export error:', err)
    res.status(500).json({ error: 'Error al exportar datos' })
  }
})

// ─── DELETE /account — GDPR account purge ────────────────────────────────────
router.delete('/account', isAuth, isAdmin, async (req: Request, res: Response) => {
  try {
    const { confirm } = req.body as { confirm?: string }

    if (confirm !== 'ELIMINAR') {
      res.status(400).json({
        error: 'Confirmación requerida. Envía { "confirm": "ELIMINAR" } para proceder.',
      })
      return
    }

    const orgId = getOrgId(req)

    // Collect all member user IDs before deletion (for token revocation)
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      select: { userId: true },
    })
    const memberUserIds = members.map(m => m.userId)

    // Nullify organization_id on models where it is nullable (avoid FK constraint errors)
    const tables = [
      'clients',
      'projects',
      'tasks',
      'content_briefs',
      'content_pieces',
      'scripts',
      'shoots',
      'teamspaces',
      'gear_items',
      'locations',
      'vehicles',
      'admin_tasks',
      'admin_task_recurrences',
      'services',
      'activity_log',
      'notifications',
      'doc_pages',
    ]

    for (const table of tables) {
      await prisma.$executeRawUnsafe(
        `UPDATE "${table}" SET organization_id = NULL WHERE organization_id = $1`,
        orgId
      )
    }

    // Delete the organization (cascades OrganizationMember, OrgSetting via Prisma onDelete: Cascade)
    await prisma.organization.delete({ where: { id: orgId } })

    // Revoke all refresh tokens for all org members
    if (memberUserIds.length > 0) {
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: memberUserIds } },
      })
    }

    // Clear auth cookie
    res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })

    res.json({ ok: true, message: 'Organización eliminada permanentemente' })
  } catch (err) {
    console.error('[billing] DELETE /account error:', err)
    res.status(500).json({ error: 'Error al eliminar la organización' })
  }
})

export default router
