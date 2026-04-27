import { prisma } from './prisma'
import { ProjectHistoryEventType, Prisma } from '@prisma/client'

interface HistoryParams {
  projectId: string
  actorId: string
  eventType: ProjectHistoryEventType
  description: string
  meta?: Record<string, unknown>
}

export async function logProjectHistory(params: HistoryParams): Promise<void> {
  try {
    await prisma.projectHistory.create({
      data: {
        projectId:   params.projectId,
        actorId:     params.actorId,
        eventType:   params.eventType,
        description: params.description,
        meta:        (params.meta ?? {}) as Prisma.InputJsonValue,
      },
    })
  } catch (err) {
    console.error('[projectHistory] Error:', err)
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
