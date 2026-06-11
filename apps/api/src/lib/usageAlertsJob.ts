import { prisma } from './prisma'
import { sendUsageAlertEmail } from './email'

export async function runUsageAlerts(): Promise<void> {
  console.log('[usageAlerts] Starting usage alerts check...')

  const orgs = await prisma.organization.findMany({
    where: { planStatus: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      slug: true,
      maxUsers: true,
      maxClients: true,
      stripeCustomerId: true,
    },
  })

  for (const org of orgs) {
    try {
      const [userCount, clientCount] = await Promise.all([
        prisma.organizationMember.count({ where: { organizationId: org.id } }),
        prisma.client.count({ where: { organizationId: org.id } }),
      ])

      const usageLines: string[] = []
      let maxPct = 0

      if (org.maxUsers > 0) {
        const userPct = userCount / org.maxUsers
        if (userPct >= 0.8) {
          const pct = Math.round(userPct * 100)
          usageLines.push(`Usuarios: ${userCount} / ${org.maxUsers} (${pct}%)`)
          if (pct > maxPct) maxPct = pct
        }
      }

      if (org.maxClients > 0) {
        const clientPct = clientCount / org.maxClients
        if (clientPct >= 0.8) {
          const pct = Math.round(clientPct * 100)
          usageLines.push(`Clientes: ${clientCount} / ${org.maxClients} (${pct}%)`)
          if (pct > maxPct) maxPct = pct
        }
      }

      if (usageLines.length === 0) continue

      // Find all ADMIN members of this org
      const adminMembers = await prisma.organizationMember.findMany({
        where: {
          organizationId: org.id,
          role: 'ADMIN',
          user: { status: 'ACTIVE' },
        },
        select: { user: { select: { email: true } } },
      })

      const adminEmails = adminMembers.map(m => m.user.email).filter(Boolean)
      if (adminEmails.length === 0) continue

      for (const email of adminEmails) {
        await sendUsageAlertEmail(email, org.name, usageLines, maxPct)
      }

      console.log(`[usageAlerts] Sent alert for org "${org.name}" to ${adminEmails.length} admin(s). Lines: ${usageLines.join(', ')}`)
    } catch (err) {
      console.error(`[usageAlerts] Error processing org ${org.id}:`, err)
    }
  }

  console.log('[usageAlerts] Done.')
}
