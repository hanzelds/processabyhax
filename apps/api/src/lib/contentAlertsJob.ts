import { prisma } from './prisma'
import { getSettings } from './settings'
import { sendPieceScheduledEmail, sendCopyAlertEmail } from './email'

export async function runContentAlerts() {
  const settings = await getSettings()
  const reminderDays  = parseInt(settings.content_reminder_days_before ?? '1', 10) || 1
  const copyAlertDays = parseInt(settings.copy_alert_days_before       ?? '2', 10) || 2

  const now     = new Date()
  const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const reminderStart = new Date(today); reminderStart.setDate(reminderStart.getDate() + reminderDays)
  const reminderEnd   = new Date(reminderStart); reminderEnd.setDate(reminderEnd.getDate() + 1)
  const copyAlertEnd  = new Date(today); copyAlertEnd.setDate(copyAlertEnd.getDate() + copyAlertDays)

  const adminLeads = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'LEAD'] }, status: 'ACTIVE' },
    select: { email: true },
  })
  const emails = adminLeads.map(u => u.email)
  if (!emails.length) return

  // 1. Publication reminder N days before
  const dueSoon = await prisma.contentPiece.findMany({
    where: { scheduledDate: { gte: reminderStart, lt: reminderEnd }, status: 'programado' },
    select: { title: true, scheduledDate: true, client: { select: { name: true } } },
  })
  for (const piece of dueSoon) {
    await sendPieceScheduledEmail({
      adminEmails: emails,
      pieceTitle: piece.title,
      clientName: piece.client.name,
      scheduledDate: piece.scheduledDate!.toISOString().split('T')[0],
      scheduledTime: null,
    }).catch(console.error)
  }

  // 2. Copy alert: scheduled within N days with copy pending
  const copyAlert = await prisma.contentPiece.findMany({
    where: { scheduledDate: { gte: today, lte: copyAlertEnd }, status: 'programado', copyStatus: 'pendiente' },
    select: { title: true, scheduledDate: true, client: { select: { name: true } } },
  })
  for (const piece of copyAlert) {
    await sendCopyAlertEmail({
      adminEmails: emails,
      pieceTitle: piece.title,
      clientName: piece.client.name,
      scheduledDate: piece.scheduledDate!.toISOString().split('T')[0],
    }).catch(console.error)
  }

  if (dueSoon.length > 0 || copyAlert.length > 0) {
    console.log(`[ContentAlerts] ${dueSoon.length} recordatorio(s) publicación · ${copyAlert.length} alerta(s) copy`)
  }
}
