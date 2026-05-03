/**
 * settings.ts — Cached access to SystemSetting values from DB.
 *
 * Uses a 30-second in-memory cache so email functions and request handlers
 * don't hit the DB on every call, but changes propagate quickly.
 */

import { prisma } from './prisma'
import { SETTING_DEFAULTS } from '../routes/systemSettings'

let cache: Record<string, string> | null = null
let cacheAt = 0
const TTL_MS = 30_000

export async function getSettings(): Promise<Record<string, string>> {
  const now = Date.now()
  if (cache && now - cacheAt < TTL_MS) return cache

  const rows = await prisma.systemSetting.findMany()
  const map: Record<string, string> = { ...SETTING_DEFAULTS }
  for (const row of rows) map[row.key] = row.value

  cache = map
  cacheAt = now
  return map
}

/** Invalidate cache (call after PATCH /settings so the new values apply fast) */
export function invalidateSettingsCache() {
  cache = null
}

/**
 * Returns true if emails should be sent for the given notification key.
 * Checks: global emails_enabled AND the per-type toggle (if provided).
 */
export async function emailEnabled(notifKey?: string): Promise<boolean> {
  const s = await getSettings()
  if (s.emails_enabled === 'false') return false
  if (notifKey && s[notifKey] === 'false') return false
  return true
}

/**
 * Returns true if WhatsApp notifications should be sent for the given key.
 * Checks: global whatsapp_enabled AND the per-type toggle (if provided).
 */
export async function whatsappEnabled(notifKey?: string): Promise<boolean> {
  const s = await getSettings()
  if (s.whatsapp_enabled !== 'true') return false   // off by default until configured
  if (notifKey && s[notifKey] === 'false') return false
  return true
}
