/**
 * One-shot migration script: wraps all existing Hax data inside the "Hax" organization.
 * Run once after deploying the multi-tenant schema.
 * Usage: cd apps/api && npx ts-node scripts/migrate-to-multitenant.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Starting multi-tenant migration for Hax...')

  // 1. Create (or find) the Hax organization
  let org = await prisma.organization.findUnique({ where: { slug: 'hax' } })
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Hax',
        slug: 'hax',
        plan: 'STUDIO',
        planStatus: 'ACTIVE',
        maxUsers: 9999,
        maxClients: 9999,
        storageGb: 500,
      },
    })
    console.log(`✅ Organization created: ${org.id}`)
  } else {
    console.log(`ℹ️  Organization already exists: ${org.id}`)
  }

  const orgId = org.id

  // 2. Enroll all existing users as OrganizationMembers
  const users = await prisma.user.findMany({ select: { id: true, role: true } })
  console.log(`👥 Enrolling ${users.length} users...`)
  for (const u of users) {
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: orgId, userId: u.id } },
      create: { organizationId: orgId, userId: u.id, role: u.role },
      update: {},
    })
  }

  // 3. Set activeOrganizationId on all users
  await prisma.user.updateMany({
    where: { activeOrganizationId: null },
    data: { activeOrganizationId: orgId },
  })
  console.log('✅ Users enrolled and activeOrganizationId set')

  // 4. Migrate primary models
  const models = [
    { label: 'clients',                table: 'clients' },
    { label: 'projects',               table: 'projects' },
    { label: 'tasks',                  table: 'tasks' },
    { label: 'content_briefs',         table: 'content_briefs' },
    { label: 'content_pieces',         table: 'content_pieces' },
    { label: 'scripts',                table: 'scripts' },
    { label: 'shoots',                 table: 'shoots' },
    { label: 'teamspaces',             table: 'teamspaces' },
    { label: 'gear_items',             table: 'gear_items' },
    { label: 'locations',              table: 'locations' },
    { label: 'vehicles',               table: 'vehicles' },
    { label: 'admin_tasks',            table: 'admin_tasks' },
    { label: 'admin_task_recurrences', table: 'admin_task_recurrences' },
    { label: 'services',               table: 'services' },
    { label: 'activity_log',           table: 'activity_log' },
    { label: 'notifications',          table: 'notifications' },
    { label: 'doc_pages',              table: 'doc_pages' },
  ]

  for (const { label, table } of models) {
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "${table}" SET organization_id = $1 WHERE organization_id IS NULL`,
      orgId
    )
    console.log(`✅ ${label}: ${result} rows updated`)
  }

  // 5. Migrate SystemSettings → OrgSettings
  const sysSettings = await prisma.systemSetting.findMany()
  console.log(`⚙️  Migrating ${sysSettings.length} system settings...`)
  for (const s of sysSettings) {
    await prisma.orgSetting.upsert({
      where: { organizationId_key: { organizationId: orgId, key: s.key } },
      create: { organizationId: orgId, key: s.key, value: s.value },
      update: {},
    })
  }
  console.log('✅ System settings migrated to OrgSettings')

  console.log('\n🎉 Migration complete! All existing data is now scoped to Hax (orgId:', orgId, ')')
}

main()
  .catch((e) => { console.error('❌ Migration failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
