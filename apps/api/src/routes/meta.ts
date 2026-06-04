import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth, isAdmin } from '../middleware/auth'

export const metaRouter = Router()

const META_TOKEN = process.env.META_ACCESS_TOKEN!
const GRAPH = 'https://graph.facebook.com/v21.0'

// ── Graph API helper ──────────────────────────────────────────────────────────
async function graph<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH}${path}`)
  url.searchParams.set('access_token', META_TOKEN)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  const json = await res.json() as any
  if (json.error) throw new Error(json.error.message)
  return json as T
}

async function graphPost<T>(path: string, body: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH}${path}`)
  url.searchParams.set('access_token', META_TOKEN)
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json() as any
  if (json.error) throw new Error(json.error.message)
  return json as T
}

// ── GET /api/meta/accounts — Ad accounts del token ───────────────────────────
// Soporta tokens de usuario (/me/adaccounts) y tokens de Business/System User
// (que requieren ir por /me/businesses → owned_ad_accounts)
metaRouter.get('/accounts', isAuth, async (req, res) => {
  const FIELDS = 'id,name,currency,account_status,amount_spent'
  try {
    // Intento 1: token de usuario normal
    const data = await graph<{ data: any[] }>('/me/adaccounts', { fields: FIELDS })
    res.json(data.data ?? [])
  } catch (e1: any) {
    // Intento 2: token de Business / System User → listar vía businesses
    try {
      const biz = await graph<{ data: { id: string; name: string }[] }>('/me/businesses', {
        fields: 'id,name',
      })
      const businesses = biz.data ?? []
      if (businesses.length === 0) {
        res.json([])
        return
      }
      // Agregar owned + client ad accounts de cada business
      const results = await Promise.all(
        businesses.map(b =>
          graph<{ data: any[] }>(`/${b.id}/owned_ad_accounts`, { fields: FIELDS })
            .then(r => r.data ?? [])
            .catch(() => [] as any[])
        )
      )
      const all = results.flat()
      res.json(all)
    } catch (e2: any) {
      console.error('[meta/accounts]', e1.message, '|', e2.message)
      res.status(502).json({ error: `No se pudieron obtener cuentas publicitarias. Intento 1: ${e1.message}. Intento 2: ${e2.message}` })
    }
  }
})

// ── GET /api/meta/pages — Páginas del token ───────────────────────────────────
metaRouter.get('/pages', isAuth, async (req, res) => {
  const FIELDS = 'id,name,fan_count,category,picture'
  try {
    // Intento 1: /me/accounts (usuario con páginas)
    const data = await graph<{ data: any[] }>('/me/accounts', { fields: FIELDS })
    res.json(data.data ?? [])
  } catch (e1: any) {
    // Intento 2: vía businesses → owned_pages
    try {
      const biz = await graph<{ data: { id: string }[] }>('/me/businesses', { fields: 'id' })
      const results = await Promise.all(
        (biz.data ?? []).map(b =>
          graph<{ data: any[] }>(`/${b.id}/owned_pages`, { fields: FIELDS })
            .then(r => r.data ?? [])
            .catch(() => [] as any[])
        )
      )
      res.json(results.flat())
    } catch (e2: any) {
      console.error('[meta/pages]', e1.message, '|', e2.message)
      res.status(502).json({ error: e2.message })
    }
  }
})

// ── GET /api/meta/accounts/:adAccountId/campaigns ────────────────────────────
metaRouter.get('/accounts/:adAccountId/campaigns', isAuth, async (req, res) => {
  const { adAccountId } = req.params
  const id = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  try {
    const data = await graph<{ data: any[] }>(`/${id}/campaigns`, {
      fields: 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,spend_cap',
      limit: '100',
    })
    res.json(data.data ?? [])
  } catch (e: any) {
    console.error('[meta/campaigns]', e.message)
    res.status(502).json({ error: e.message })
  }
})

// ── GET /api/meta/accounts/:adAccountId/insights ─────────────────────────────
// Query params: since, until, level (campaign|account)
metaRouter.get('/accounts/:adAccountId/insights', isAuth, async (req, res) => {
  const { adAccountId } = req.params
  const id = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  const { since, until, level = 'account' } = req.query as Record<string, string>

  // Default: últimos 30 días
  const today = new Date()
  const sinceDate = since || new Date(today.setDate(today.getDate() - 30)).toISOString().slice(0, 10)
  const untilDate = until || new Date().toISOString().slice(0, 10)

  try {
    const params: Record<string, string> = {
      fields: 'campaign_id,campaign_name,spend,impressions,clicks,ctr,cpm,reach,actions,date_start,date_stop',
      level,
      time_range: JSON.stringify({ since: sinceDate, until: untilDate }),
      limit: '200',
    }
    const data = await graph<{ data: any[] }>(`/${id}/insights`, params)
    res.json(data.data ?? [])
  } catch (e: any) {
    console.error('[meta/insights]', e.message)
    res.status(502).json({ error: e.message })
  }
})

// ── GET /api/meta/pages/:pageId/insights ─────────────────────────────────────
metaRouter.get('/pages/:pageId/insights', isAuth, async (req, res) => {
  const { pageId } = req.params
  const { since, until } = req.query as Record<string, string>
  const today = new Date()
  const sinceDate = since || new Date(today.setDate(today.getDate() - 30)).toISOString().slice(0, 10)
  const untilDate = until || new Date().toISOString().slice(0, 10)

  try {
    const [pageData, insightsData] = await Promise.all([
      graph<any>(`/${pageId}`, { fields: 'id,name,fan_count,category,picture,followers_count' }),
      graph<{ data: any[] }>(`/${pageId}/insights`, {
        metric: 'page_impressions,page_engaged_users,page_reach,page_post_engagements',
        since: sinceDate,
        until: untilDate,
        period: 'total_over_range',
      }),
    ])
    res.json({ page: pageData, insights: insightsData.data ?? [] })
  } catch (e: any) {
    console.error('[meta/page-insights]', e.message)
    res.status(502).json({ error: e.message })
  }
})

// ── PATCH /api/meta/campaigns/:campaignId/status ──────────────────────────────
metaRouter.patch('/campaigns/:campaignId/status', isAuth, isAdmin, async (req, res) => {
  const { campaignId } = req.params
  const { status } = req.body
  if (!['ACTIVE', 'PAUSED'].includes(status)) {
    res.status(400).json({ error: 'Status debe ser ACTIVE o PAUSED' }); return
  }
  try {
    await graphPost(`/${campaignId}`, { status })
    res.json({ success: true, status })
  } catch (e: any) {
    console.error('[meta/campaign-status]', e.message)
    res.status(502).json({ error: e.message })
  }
})

// ── GET /api/meta/clients/:clientId/linked ────────────────────────────────────
metaRouter.get('/clients/:clientId/linked', isAuth, async (req, res) => {
  try {
    const accounts = await prisma.clientMetaAccount.findMany({
      where: { clientId: req.params.clientId },
      orderBy: { createdAt: 'asc' },
    })
    res.json(accounts)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// ── POST /api/meta/clients/:clientId/link ─────────────────────────────────────
metaRouter.post('/clients/:clientId/link', isAuth, isAdmin, async (req, res) => {
  const { adAccountId, adAccountName, pageId, pageName } = req.body
  if (!adAccountId || !adAccountName) {
    res.status(400).json({ error: 'adAccountId y adAccountName son requeridos' }); return
  }
  try {
    const account = await prisma.clientMetaAccount.upsert({
      where: { clientId_adAccountId: { clientId: req.params.clientId, adAccountId } },
      create: { clientId: req.params.clientId, adAccountId, adAccountName, pageId: pageId || null, pageName: pageName || null },
      update: { adAccountName, pageId: pageId || null, pageName: pageName || null },
    })
    res.status(201).json(account)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// ── DELETE /api/meta/clients/:clientId/link/:id ───────────────────────────────
metaRouter.delete('/clients/:clientId/link/:id', isAuth, isAdmin, async (req, res) => {
  try {
    await prisma.clientMetaAccount.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /api/meta/overview — Todas las cuentas vinculadas con sus métricas ────
metaRouter.get('/overview', isAuth, async (req, res) => {
  const { since, until } = req.query as Record<string, string>
  const today = new Date()
  const sinceDate = since || new Date(new Date().setDate(today.getDate() - 30)).toISOString().slice(0, 10)
  const untilDate = until || new Date().toISOString().slice(0, 10)

  try {
    const linked = await prisma.clientMetaAccount.findMany({
      include: { client: { select: { id: true, name: true, color: true } } },
      orderBy: { createdAt: 'asc' },
    })

    const results = await Promise.allSettled(
      linked.map(async (acct) => {
        try {
          const id = acct.adAccountId.startsWith('act_') ? acct.adAccountId : `act_${acct.adAccountId}`
          const insights = await graph<{ data: any[] }>(`/${id}/insights`, {
            fields: 'spend,impressions,clicks,ctr,cpm,reach,actions',
            level: 'account',
            time_range: JSON.stringify({ since: sinceDate, until: untilDate }),
          })
          const m = insights.data?.[0] ?? {}
          const campaigns = await graph<{ data: any[] }>(`/${id}/campaigns`, {
            fields: 'id,status',
            filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]),
            limit: '200',
          })
          return {
            ...acct,
            metrics: {
              spend: m.spend ?? '0',
              impressions: m.impressions ?? '0',
              clicks: m.clicks ?? '0',
              ctr: m.ctr ?? '0',
              cpm: m.cpm ?? '0',
              reach: m.reach ?? '0',
              activeCampaigns: campaigns.data?.length ?? 0,
            },
          }
        } catch {
          return { ...acct, metrics: null }
        }
      })
    )

    res.json(results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean))
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})
