import { prisma } from './prisma'
import { sendPieceScheduledEmail, sendCopyAlertEmail } from './email'

export async function runContentAlerts() {
  const now     = new Date()
  const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const in48h   = new Date(today); in48h.setDate(in48h.getDate() + 2)

  const adminLeads = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'LEAD'] }, status: 'ACTIVE' },
    select: { email: true },
  })
  const emails = adminLeads.map(u => u.email)
  if (!emails.length) return

  // 1. Reminder 24h before publish
  const dueTomorrow = await prisma.contentPiece.findMany({
    where: { scheduledDate: { gte: tomorrow, lt: in48h }, status: 'programado' },
    select: { title: true, scheduledDate: true, client: { select: { name: true } } },
  })
  for (const piece of dueTomorrow) {
    await sendPieceScheduledEmail({
      adminEmails: emails,
      pieceTitle: piece.title,
      clientName: piece.client.name,
      scheduledDate: piece.scheduledDate!.toISOString().split('T')[0],
      scheduledTime: null,
    }).catch(console.error)
  }

  // 2. Copy alert: scheduled within 48h with copy pending
  const copyAlert = await prisma.contentPiece.findMany({
    where: { scheduledDate: { gte: today, lte: in48h }, status: 'programado', copyStatus: 'pendiente' },
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

  console.log(`[ContentAlerts] Checked: ${dueTomorrow.length} reminders, ${copyAlert.length} copy alerts`)
}
