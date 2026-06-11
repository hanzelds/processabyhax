import { Response } from 'express'
import { prisma } from './prisma'

/**
 * Returns the Organization with its current usage counts.
 */
export async function getOrgUsage(organizationId: string) {
  const [org, userCount, clientCount] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { maxUsers: true, maxClients: true, storageGb: true, plan: true, planStatus: true },
    }),
    prisma.organizationMember.count({ where: { organizationId } }),
    prisma.client.count({ where: { organizationId } }),
  ])
  return { org, userCount, clientCount }
}

/**
 * Throws a limit-error object if the org has reached its user limit.
 */
export async function assertUserLimit(organizationId: string): Promise<void> {
  const { org, userCount } = await getOrgUsage(organizationId)
  if (!org) throw new Error('Organización no encontrada')
  if (userCount >= org.maxUsers) {
    throw {
      status: 403,
      error: `Límite de usuarios alcanzado (${userCount}/${org.maxUsers}). Actualiza tu plan para agregar más usuarios.`,
      limitReached: true,
    }
  }
}

/**
 * Throws a limit-error object if the org has reached its client limit.
 */
export async function assertClientLimit(organizationId: string): Promise<void> {
  const { org, clientCount } = await getOrgUsage(organizationId)
  if (!org) throw new Error('Organización no encontrada')
  if (clientCount >= org.maxClients) {
    throw {
      status: 403,
      error: `Límite de clientes alcanzado (${clientCount}/${org.maxClients}). Actualiza tu plan para agregar más clientes.`,
      limitReached: true,
    }
  }
}

/**
 * Checks if the error is a limit-reached error, sends the response, and returns true.
 * Returns false if it is not a limit error (so the caller can re-throw or handle it).
 */
export function handleLimitError(err: unknown, res: Response): boolean {
  if (
    err !== null &&
    typeof err === 'object' &&
    (err as Record<string, unknown>).limitReached === true
  ) {
    const limitErr = err as { status: number; error: string; limitReached: true }
    res.status(limitErr.status).json({ error: limitErr.error, limitReached: true })
    return true
  }
  return false
}
