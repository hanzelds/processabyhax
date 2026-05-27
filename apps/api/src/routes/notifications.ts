import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAuth } from '../middleware/auth'
import { registerSSEClient, removeSSEClient } from '../lib/notify'

export const notificationsRouter = Router()

// ── GET /api/notifications/stream (SSE) ───────────────────────────────────────
// Must be declared BEFORE /:id routes to avoid route conflicts.
// Keeps the HTTP connection open and pushes new notifications as they arrive.

notificationsRouter.get('/stream', isAuth, async (req, res) => {
  const userId = req.user!.userId

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // disable Nginx proxy buffering
  res.flushHeaders()

  // Send initial unread count so the badge is accurate right away
  try {
    const count = await prisma.notification.count({ where: { userId, readAt: null } })
    res.write(`data: ${JSON.stringify({ type: 'init', unreadCount: count })}\n\n`)
  } catch { /* ignore */ }

  // Register this response so createNotification() can push to it
  registerSSEClient(userId, res as any)

  // Heartbeat every 25s — keeps the connection alive through load balancers / Nginx
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n') } catch { clearInterval(heartbeat) }
  }, 25_000)

  req.on('close', () => {
    clearInterval(heartbeat)
    removeSSEClient(userId, res as any)
  })
})

// ── GET /api/notifications ────────────────────────────────────────────────────

notificationsRouter.get('/', isAuth, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where:   { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take:    50,
    })
    res.json(notifications)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al obtener notificaciones' })
  }
})

// ── GET /api/notifications/unread-count ───────────────────────────────────────

notificationsRouter.get('/unread-count', isAuth, async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.userId, readAt: null },
    })
    res.json({ count })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error' })
  }
})

// ── POST /api/notifications/read-all ─────────────────────────────────────────

notificationsRouter.post('/read-all', isAuth, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, readAt: null },
      data:  { readAt: new Date() },
    })
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error' })
  }
})

// ── DELETE /api/notifications (clear all) ────────────────────────────────────

notificationsRouter.delete('/', isAuth, async (req, res) => {
  try {
    await prisma.notification.deleteMany({ where: { userId: req.user!.userId } })
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al vaciar notificaciones' })
  }
})

// ── PATCH /api/notifications/:id/read ────────────────────────────────────────

notificationsRouter.patch('/:id/read', isAuth, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.userId },
      data:  { readAt: new Date() },
    })
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error' })
  }
})

// ── DELETE /api/notifications/:id (dismiss single) ───────────────────────────

notificationsRouter.delete('/:id', isAuth, async (req, res) => {
  try {
    await prisma.notification.deleteMany({
      where: { id: req.params.id, userId: req.user!.userId },
    })
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al eliminar notificación' })
  }
})
