/**
 * taskRemindersJob.ts — Cron diario de recordatorios WhatsApp de tareas.
 *
 * - Recordatorio 24h antes: tareas que vencen mañana
 * - Primer aviso vencimiento: tareas que vencieron ayer (notifica solo 1 vez)
 */

import { prisma } from './prisma'
import { notifyTaskDueSoon, notifyTaskOverdue } from './whatsapp'

function startOf(d: Date): Date {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r
}
function endOf(d: Date): Date {
  const r = new Date(d); r.setHours(23, 59, 59, 999); return r
}

const ASSIGNEE_INCLUDE = {
  user: { select: { phone: true, whatsappNotif: true, name: true } },
}

export async function sendTaskReminders(): Promise<void> {
  const today     = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow  = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)

  // ── Tareas que vencen mañana (recordatorio 24h) ───────────────────────────
  const dueSoon = await prisma.task.findMany({
    where: {
      dueDate:   { gte: tomorrow, lt: new Date(tomorrow.getTime() + 86400000) },
      status:    { notIn: ['COMPLETED'] },
      assignees: { some: {} },
    },
    include: {
      assignees: { include: ASSIGNEE_INCLUDE },
      project:   { select: { name: true } },
    },
  })

  for (const task of dueSoon) {
    for (const { user } of task.assignees) {
      await notifyTaskDueSoon({
        user:        { phone: user.phone ?? null, whatsappNotif: user.whatsappNotif },
        taskTitle:   task.title,
        projectName: task.project.name,
      }).catch(e => console.error('[Reminders] dueSoon error:', e))
    }
  }

  // ── Tareas que vencieron ayer (primer día de vencimiento) ─────────────────
  const overdue = await prisma.task.findMany({
    where: {
      dueDate:   { gte: startOf(yesterday), lte: endOf(yesterday) },
      status:    { notIn: ['COMPLETED'] },
      assignees: { some: {} },
    },
    include: {
      assignees: { include: ASSIGNEE_INCLUDE },
      project:   { select: { name: true } },
    },
  })

  for (const task of overdue) {
    for (const { user } of task.assignees) {
      await notifyTaskOverdue({
        user:        { phone: user.phone ?? null, whatsappNotif: user.whatsappNotif },
        taskTitle:   task.title,
        projectName: task.project.name,
      }).catch(e => console.error('[Reminders] overdue error:', e))
    }
  }

  const totalAssignees = dueSoon.reduce((s, t) => s + t.assignees.length, 0) + overdue.reduce((s, t) => s + t.assignees.length, 0)
  if (totalAssignees > 0) {
    console.log(`[Reminders] ${dueSoon.length} tarea(s) por vencer · ${overdue.length} vencida(s) → ${totalAssignees} notificacion(es)`)
  }
}
