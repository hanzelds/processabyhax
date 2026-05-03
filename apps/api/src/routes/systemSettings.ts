import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAdmin } from '../middleware/auth'
import { ALL_PERMISSIONS, PERMISSION_LABEL, PERMISSION_MODULE, ROLE_DEFAULTS } from '../lib/permissions'
import { invalidateSettingsCache } from '../lib/settings'
import { isWhatsAppConfigured } from '../lib/whatsapp'

export const systemSettingsRouter = Router()
systemSettingsRouter.use(isAdmin)

// ── Default values ────────────────────────────────────────────────────────────

export const SETTING_DEFAULTS: Record<string, string> = {
  // ── Identidad ─────────────────────────────────────────────────────────────
  company_name:                    'Processa by Hax',
  app_url:                         'https://processa.hax.com.do',
  email_from:                      'Processa by Hax <noreply@hax.com.do>',
  support_email:                   '',
  timezone:                        'America/Santo_Domingo',

  // ── Seguridad ─────────────────────────────────────────────────────────────
  session_duration_days:           '30',
  max_sessions_per_user:           '10',
  password_min_length:             '6',
  require_2fa:                     'false',         // futuro

  // ── Usuarios ──────────────────────────────────────────────────────────────
  require_area:                    'false',
  default_user_role:               'TEAM',
  invite_only:                     'true',
  user_suspension_after_days:      '0',             // 0 = desactivado

  // ── Proyectos ─────────────────────────────────────────────────────────────
  allow_team_see_all_projects:     'false',
  allow_team_create_projects:      'false',
  project_requires_description:    'false',
  project_requires_estimated_close:'false',
  project_auto_complete:           'false',         // completar proyecto si todas sus tareas completas

  // ── Tareas ────────────────────────────────────────────────────────────────
  default_task_due_days:           '7',
  max_file_size_mb:                '100',
  require_task_type:               'false',
  allow_team_create_tasks:         'false',
  allow_team_delete_tasks:         'false',
  allow_team_reopen_tasks:         'false',
  auto_assign_to_creator:          'false',
  kanban_completed_visible_days:   '7',

  // ── Contenido ─────────────────────────────────────────────────────────────
  content_reminder_days_before:    '1',
  copy_alert_days_before:          '2',
  content_default_publish_time:    '09:00',

  // ── Email ─────────────────────────────────────────────────────────────────
  emails_enabled:                  'true',
  notify_task_assigned:            'true',
  notify_task_status:              'true',
  notify_brief_assigned:           'true',
  notify_brief_status:             'true',
  notify_piece_scheduled:          'true',
  notify_piece_published:          'true',
  notify_copy_alert:               'true',
  // Portal de cliente
  email_portal_link:               'true',
  email_portal_approval:           'true',
  email_portal_changes:            'true',
  email_portal_expiry:             'true',
  email_portal_all_approved:       'true',

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  whatsapp_enabled:                'false',
  whatsapp_notify_task_assigned:   'true',
  whatsapp_notify_task_status:     'true',
  whatsapp_notify_due_soon:        'true',
  whatsapp_notify_overdue:         'true',
  whatsapp_reminders_time:         '08:00',

  // ── Sistema ───────────────────────────────────────────────────────────────
  maintenance_mode:                'false',
  activity_log_enabled:            'true',
  log_retention_days:              '90',
}

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.systemSetting.findMany()
  const map: Record<string, string> = { ...SETTING_DEFAULTS }
  for (const row of rows) map[row.key] = row.value
  return map
}

// ── GET /api/admin/system/settings ───────────────────────────────────────────

systemSettingsRouter.get('/settings', async (_req, res) => {
  const settings = await getSettings()
  // Añadir indicadores de configuración de env vars (readonly, no se guardan en DB)
  const meta = {
    whatsapp_token_configured: isWhatsAppConfigured(),
    email_resend_configured: !!process.env.RESEND_API_KEY,
  }
  res.json({ ...settings, ...meta })
})

// ── PATCH /api/admin/system/settings ─────────────────────────────────────────

systemSettingsRouter.patch('/settings', async (req, res) => {
  const { userId } = req.user!
  const updates = req.body as Record<string, string>

  const allowed = new Set(Object.keys(SETTING_DEFAULTS))
  const ops = Object.entries(updates).filter(([k]) => allowed.has(k))

  await Promise.all(ops.map(([key, value]) =>
    prisma.systemSetting.upsert({
      where: { key },
      update: { value, updatedById: userId },
      create: { key, value, updatedById: userId },
    })
  ))

  invalidateSettingsCache()
  const settings = await getSettings()
  res.json(settings)
})

// ── GET /api/admin/system/permissions ────────────────────────────────────────

systemSettingsRouter.get('/permissions', (_req, res) => {
  const roles = ['ADMIN', 'LEAD', 'TEAM'] as const

  const matrix = ALL_PERMISSIONS.map(p => ({
    permission: p,
    label:      PERMISSION_LABEL[p],
    module:     PERMISSION_MODULE[p],
    roles: {
      ADMIN: ROLE_DEFAULTS['ADMIN']?.includes(p) ?? false,
      LEAD:  ROLE_DEFAULTS['LEAD']?.includes(p)  ?? false,
      TEAM:  ROLE_DEFAULTS['TEAM']?.includes(p)  ?? false,
    },
  }))

  res.json(matrix)
})

// ── GET /api/admin/system/stats ───────────────────────────────────────────────

systemSettingsRouter.get('/stats', async (_req, res) => {
  const [
    usersByRole, clients, projects, tasks,
    briefs, contentPieces, adminTasks,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { id: true } }),
    prisma.client.count(),
    prisma.project.count(),
    prisma.task.count(),
    prisma.contentBrief.count(),
    prisma.contentPiece.count(),
    prisma.adminTask.count(),
  ])

  const [activeProjects, completedTasks, overdueTasks, activeClients] = await Promise.all([
    prisma.project.count({ where: { status: { in: ['ACTIVE', 'IN_PROGRESS'] } } }),
    prisma.task.count({ where: { status: 'COMPLETED' } }),
    prisma.task.count({
      where: {
        status: { notIn: ['COMPLETED'] },
        dueDate: { lt: new Date() },
      },
    }),
    prisma.client.count({ where: { status: 'ACTIVE' } }),
  ])

  res.json({
    users: {
      total: usersByRole.reduce((s, r) => s + r._count.id, 0),
      byRole: Object.fromEntries(usersByRole.map(r => [r.role, r._count.id])),
    },
    clients: { total: clients, active: activeClients },
    projects: { total: projects, active: activeProjects },
    tasks: { total: tasks, completed: completedTasks, overdue: overdueTasks },
    content: { briefs, pieces: contentPieces },
    adminTasks,
  })
})
