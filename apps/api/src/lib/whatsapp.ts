/**
 * whatsapp.ts — Meta WhatsApp Business Cloud API
 *
 * Fire-and-forget: un error en WhatsApp nunca interrumpe la operación principal.
 * Token y número vienen de env vars. Los toggles (global + por tipo) vienen de DB.
 */

import { whatsappEnabled } from './settings'

const TOKEN      = process.env.WHATSAPP_TOKEN
const PHONE_ID   = process.env.WHATSAPP_PHONE_NUMBER_ID
const API_VER    = process.env.WHATSAPP_API_VERSION || 'v19.0'
const APP_URL    = process.env.APP_URL || 'https://processa.hax.com.do'

// ── Formatters ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  PENDING:     'Pendiente',
  IN_PROGRESS: 'En progreso',
  IN_REVIEW:   'En revisión',
  COMPLETED:   'Completada',
  BLOCKED:     'Bloqueada',
}

export function fmtStatus(status: string): string {
  return STATUS_LABEL[status] ?? status
}

export function fmtDate(date: Date | string | null | undefined): string {
  if (!date) return 'Sin fecha'
  return new Date(date).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Core sender ───────────────────────────────────────────────────────────────

/**
 * Envía un mensaje de texto a un número de WhatsApp.
 * Retorna silenciosamente si no hay token o el número no es válido.
 */
export async function sendWhatsApp(to: string, message: string): Promise<void> {
  if (!TOKEN || !PHONE_ID) return   // No configurado — silencio
  if (!to) return

  // Normalizar: quitar espacios, guiones, paréntesis
  const phone = to.replace(/[\s\-\(\)]/g, '')
  if (!phone.startsWith('+')) return  // Formato internacional obligatorio

  const url = `https://graph.facebook.com/${API_VER}/${PHONE_ID}/messages`

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to:                phone,
        type:              'text',
        text:              { body: message },
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[WhatsApp] Error al enviar:', JSON.stringify(err))
    }
  } catch (err: unknown) {
    console.error('[WhatsApp] Error de red:', err instanceof Error ? err.message : err)
  }
}

// ── Higher-level notifiers ────────────────────────────────────────────────────

interface NotifyUser {
  phone?: string | null
  whatsappNotif: boolean
}

/**
 * Notifica a un usuario respetando su opt-out y el toggle global + por tipo.
 */
async function notify(
  user: NotifyUser,
  message: string,
  settingKey: string,
): Promise<void> {
  if (!user.phone)           return  // Sin teléfono
  if (!user.whatsappNotif)   return  // Opt-out del usuario
  const enabled = await whatsappEnabled(settingKey)
  if (!enabled) return
  await sendWhatsApp(user.phone, message)
}

// ── Eventos de negocio ────────────────────────────────────────────────────────

export async function notifyTaskAssigned(params: {
  user: NotifyUser
  taskTitle: string
  projectName: string
  dueDate?: Date | string | null
}): Promise<void> {
  const { user, taskTitle, projectName, dueDate } = params
  await notify(user,
    `📋 *Nueva tarea asignada*\n\n` +
    `*${taskTitle}*\n` +
    `Proyecto: ${projectName}\n` +
    (dueDate ? `Fecha límite: ${fmtDate(dueDate)}\n` : '') +
    `\nVer en Processa: ${APP_URL}`,
    'whatsapp_notify_task_assigned',
  )
}

export async function notifyTaskStatusChanged(params: {
  user: NotifyUser
  taskTitle: string
  fromStatus: string
  toStatus: string
  changerName: string
}): Promise<void> {
  const { user, taskTitle, fromStatus, toStatus, changerName } = params
  await notify(user,
    `🔄 *Tarea actualizada*\n\n` +
    `*${taskTitle}*\n` +
    `Estado: ${fmtStatus(fromStatus)} → ${fmtStatus(toStatus)}\n` +
    `Por: ${changerName}\n\n` +
    `Ver en Processa: ${APP_URL}`,
    'whatsapp_notify_task_status',
  )
}

export async function notifyTaskDueSoon(params: {
  user: NotifyUser
  taskTitle: string
  projectName: string
}): Promise<void> {
  const { user, taskTitle, projectName } = params
  await notify(user,
    `⏰ *Recordatorio de tarea*\n\n` +
    `*${taskTitle}*\n` +
    `Proyecto: ${projectName}\n` +
    `Vence mañana\n\n` +
    `Ver en Processa: ${APP_URL}`,
    'whatsapp_notify_due_soon',
  )
}

export async function notifyTaskOverdue(params: {
  user: NotifyUser
  taskTitle: string
  projectName: string
}): Promise<void> {
  const { user, taskTitle, projectName } = params
  await notify(user,
    `🔴 *Tarea vencida*\n\n` +
    `*${taskTitle}*\n` +
    `Proyecto: ${projectName}\n` +
    `Venció ayer\n\n` +
    `Ver en Processa: ${APP_URL}`,
    'whatsapp_notify_overdue',
  )
}

/** Verdadero si el token y el phone ID están configurados como env vars */
export function isWhatsAppConfigured(): boolean {
  return !!(TOKEN && PHONE_ID)
}
