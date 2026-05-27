import type { ServerResponse } from 'http'
import { prisma } from './prisma'

interface NotifyParams {
  userId: string
  type: string
  title: string
  body: string
  link?: string
}

// ── SSE client registry ───────────────────────────────────────────────────────
// Maps userId → set of open response streams. When a notification is created
// for a user that has an active SSE connection, it is pushed immediately.

const sseClients = new Map<string, Set<ServerResponse>>()

export function registerSSEClient(userId: string, res: ServerResponse) {
  if (!sseClients.has(userId)) sseClients.set(userId, new Set())
  sseClients.get(userId)!.add(res)
}

export function removeSSEClient(userId: string, res: ServerResponse) {
  sseClients.get(userId)?.delete(res)
  if (sseClients.get(userId)?.size === 0) sseClients.delete(userId)
}

function pushSSE(userId: string, data: object) {
  const clients = sseClients.get(userId)
  if (!clients || clients.size === 0) return
  const payload = `data: ${JSON.stringify(data)}\n\n`
  for (const res of [...clients]) {
    try {
      res.write(payload)
    } catch {
      // Connection died — remove it
      clients.delete(res)
    }
  }
  if (clients.size === 0) sseClients.delete(userId)
}

// ── Notification creation ─────────────────────────────────────────────────────

export async function createNotification(params: NotifyParams) {
  try {
    const notification = await prisma.notification.create({ data: params })

    // Push to connected SSE client immediately (real-time delivery)
    pushSSE(params.userId, notification)

    // Keep max 100 notifications per user — delete oldest beyond that
    const overflow = await prisma.notification.findMany({
      where:   { userId: params.userId },
      orderBy: { createdAt: 'desc' },
      skip:    100,
      select:  { id: true },
    })
    if (overflow.length > 0) {
      await prisma.notification.deleteMany({ where: { id: { in: overflow.map(o => o.id) } } })
    }
  } catch (err) {
    console.error('[Notify] Failed to create notification:', err)
  }
}

export async function createNotifications(list: NotifyParams[]) {
  await Promise.all(list.map(p => createNotification(p)))
}
