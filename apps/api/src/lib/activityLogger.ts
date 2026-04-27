import { prisma } from './prisma'
import { ActivityEventType, ActivityEntityType, Prisma } from '@prisma/client'

interface LogParams {
  actorId: string
  eventType: ActivityEventType
  entityType: ActivityEntityType
  entityId: string
  entityName: string
  meta?: Record<string, unknown>
}

export async function logActivity(params: LogParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        actorId:    params.actorId,
        eventType:  params.eventType,
        entityType: params.entityType,
        entityId:   params.entityId,
        entityName: params.entityName,
        meta:       (params.meta ?? {}) as Prisma.InputJsonValue,
      },
    })
  } catch (err) {
    // El log nunca debe interrumpir la operación principal
    console.error('[activityLogger] Error registrando actividad:', err)
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
