import { prisma } from './prisma'
import { ClientHistoryEventType, Prisma } from '@prisma/client'

interface HistoryParams {
  clientId: string
  actorId: string
  eventType: ClientHistoryEventType
  description: string
  meta?: Record<string, unknown>
}

export async function logClientHistory(params: HistoryParams): Promise<void> {
  try {
    await prisma.clientHistory.create({
      data: {
        clientId:    params.clientId,
        actorId:     params.actorId,
        eventType:   params.eventType,
        description: params.description,
        meta:        (params.meta ?? {}) as Prisma.InputJsonValue,
      },
    })
  } catch (err) {
    console.error('[clientHistory] Error:', err)
  }
}

export function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'ahora mismo'
  if (mins < 60)  return `hace ${mins} minuto${mins !== 1 ? 's' : ''}`
  if (hours < 24) return `hace ${hours} hora${hours !== 1 ? 's' : ''}`
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}
