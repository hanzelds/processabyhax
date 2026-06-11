import { Request } from 'express'

/**
 * Returns the organizationId from the JWT payload.
 * Use this in every route to scope queries to the current tenant.
 */
export function getOrgId(req: Request): string {
  const orgId = req.user?.organizationId
  if (!orgId) throw new Error('No organization context in token')
  return orgId
}

/**
 * Safe version — returns null when there's no org context.
 * Only use for endpoints that must work without an org (e.g., portal token routes).
 */
export function getOrgIdSafe(req: Request): string | null {
  return req.user?.organizationId ?? null
}
