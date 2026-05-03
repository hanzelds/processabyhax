import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { prisma } from '../lib/prisma'
import { isAuth, isAdmin } from '../middleware/auth'
import { Role, UserStatus } from '@prisma/client'
import { sendInvitationEmail } from '../lib/email'
import { getSettings } from '../lib/settings'
import {
  ALL_PERMISSIONS, PERMISSION_LABEL, PERMISSION_MODULE,
  ROLE_DEFAULTS, getEffectivePermissions, Permission
} from '../lib/permissions'

export const usersRouter = Router()

const APP_URL = process.env.APP_URL || 'https://processa.hax.com.do'

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

// Multer for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = '/home/koderadmin/processa/uploads/avatars'
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`)
  },
})
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true)
    else cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'))
  },
})

// Express static for avatars (called in index.ts)
export const AVATAR_UPLOAD_DIR = '/home/koderadmin/processa/uploads/avatars'

// Relative time helper
function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const min = Math.floor(diff / 60000)
  const hr  = Math.floor(min / 60)
  const day = Math.floor(hr / 24)
  if (min < 2)   return 'hace un momento'
  if (min < 60)  return `hace ${min} minutos`
  if (hr < 24)   return `hace ${hr} hora${hr > 1 ? 's' : ''}`
  if (day < 30)  return `hace ${day} día${day > 1 ? 's' : ''}`
  const mon = Math.floor(day / 30)
  return `hace ${mon} mes${mon > 1 ? 'es' : ''}`
}

// ── GET /users ────────────────────────────────────────────────────────────────

usersRouter.get('/', isAuth, async (req, res) => {
  if (req.user!.role !== 'ADMIN' && req.user!.role !== 'LEAD') {
    res.status(403).json({ error: 'Sin permiso' }); return
  }

  const { status, area, role: roleFilter, q } = req.query
  const where: Record<string, unknown> = {}
  if (status && status !== 'ALL') where.status = status as UserStatus
  if (area)   where.area   = area
  if (roleFilter && roleFilter !== 'ALL') where.role = roleFilter as Role
  if (q) where.OR = [
    { name:  { contains: q as string, mode: 'insensitive' } },
    { email: { contains: q as string, mode: 'insensitive' } },
  ]

  const today = new Date(); today.setHours(0, 0, 0, 0)

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true, name: true, email: true, role: true, area: true, status: true,
      avatarUrl: true, bio: true, joinedAt: true, lastSeenAt: true, createdAt: true,
      skills: { include: { skill: true } },
      _count: { select: { refreshTokens: { where: { revokedAt: null, expiresAt: { gt: new Date() } } } } },
    },
    orderBy: { name: 'asc' },
  })

  // Enrich with workload metrics
  const enriched = await Promise.all(users.map(async u => {
    const [activeTasks, overdueTasks] = await Promise.all([
      prisma.task.count({ where: { assignees: { some: { userId: u.id } }, status: { notIn: ['COMPLETED'] } } }),
      prisma.task.count({ where: { assignees: { some: { userId: u.id } }, status: { notIn: ['COMPLETED'] }, dueDate: { lt: today } } }),
    ])
    return {
      ...u,
      skills: u.skills.map(s => s.skill),
      activeTasks,
      overdueTasks,
      activeSessions: u._count.refreshTokens,
      lastSeenRelative: u.lastSeenAt ? relativeTime(u.lastSeenAt) : null,
    }
  }))

  res.json(enriched)
})

// ── GET /users/:id ─────────────────────────────────────────────────────────────

usersRouter.get('/:id', isAuth, async (req, res) => {
  const { userId, role } = req.user!
  const isOwnProfile = userId === req.params.id
  if (!isOwnProfile && role !== 'ADMIN' && role !== 'LEAD') {
    res.status(403).json({ error: 'Sin permiso' }); return
  }

  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { skills: { include: { skill: true } } },
  })
  if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return }

  const { password: _, ...safe } = user
  res.json({ ...safe, skills: safe.skills.map(s => s.skill) })
})

// ── GET /users/:id/metrics ────────────────────────────────────────────────────

usersRouter.get('/:id/metrics', isAuth, async (req, res) => {
  const { userId, role } = req.user!
  if (userId !== req.params.id && role !== 'ADMIN' && role !== 'LEAD') {
    res.status(403).json({ error: 'Sin permiso' }); return
  }

  const uid = req.params.id
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [completedTotal, completedMonth, activeTasks, overdueTasks, activity] = await Promise.all([
    prisma.task.count({ where: { assignees: { some: { userId: uid } }, status: 'COMPLETED' } }),
    prisma.task.count({ where: { assignees: { some: { userId: uid } }, status: 'COMPLETED', completedAt: { gte: monthStart } } }),
    prisma.task.count({ where: { assignees: { some: { userId: uid } }, status: { notIn: ['COMPLETED'] } } }),
    prisma.task.count({ where: { assignees: { some: { userId: uid } }, status: { notIn: ['COMPLETED'] }, dueDate: { lt: today } } }),
    prisma.activityLog.findMany({
      where: { actorId: uid },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  // Completion rate (completed on time / total completed)
  const completedOnTime = await prisma.task.count({
    where: {
      assignees: { some: { userId: uid } },
      status: 'COMPLETED',
      dueDate: { not: null },
      completedAt: { not: null },
    },
  })
  // Rough rate: completedOnTime / completedTotal (if completedTotal > 0)
  const completionRatePct = completedTotal > 0
    ? Math.round((completedOnTime / completedTotal) * 100)
    : null

  // Active projects (where user has at least 1 non-completed task)
  const activeProjects = await prisma.task.groupBy({
    by: ['projectId'],
    where: { assignees: { some: { userId: uid } }, status: { notIn: ['COMPLETED'] } },
  })

  // Work by project (completed tasks)
  const workByProject = await prisma.task.groupBy({
    by: ['projectId'],
    where: { assignees: { some: { userId: uid } }, status: 'COMPLETED' },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  })
  const projectIds = workByProject.map(w => w.projectId)
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    include: { client: { select: { name: true } } },
  })
  const projectMap = new Map(projects.map(p => [p.id, p]))

  res.json({
    tasksCompletedTotal:    completedTotal,
    tasksCompletedMonth:    completedMonth,
    completionRatePct,
    activeProjects:         activeProjects.length,
    currentWorkload:        activeTasks,
    overdueTasks,
    recentActivity: activity.map(a => ({
      ...a,
      relativeTime: relativeTime(a.createdAt),
    })),
    workByProject: workByProject.map(w => ({
      projectId:   w.projectId,
      projectName: projectMap.get(w.projectId)?.name ?? '—',
      clientName:  projectMap.get(w.projectId)?.client?.name ?? '—',
      count: w._count.id,
    })),
  })
})

// ── POST /users ───────────────────────────────────────────────────────────────

usersRouter.post('/', isAdmin, async (req, res) => {
  const { name, email, role, area, joinedAt } = req.body
  if (!name || !email) { res.status(400).json({ error: 'Nombre y email son requeridos' }); return }

  const inviteSettings = await getSettings()
  if (inviteSettings.require_area === 'true' && !area) {
    res.status(400).json({ error: 'El área del usuario es obligatoria' }); return
  }

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) { res.status(409).json({ error: 'El email ya está registrado' }); return }

  // Create user with INVITED status and a placeholder password
  const placeholder = await bcrypt.hash(uuidv4(), 10)
  const user = await prisma.user.create({
    data: {
      name, email,
      password: placeholder,
      role: (role as Role) || 'TEAM',
      area: area || null,
      status: 'INVITED',
      joinedAt: joinedAt ? new Date(joinedAt) : null,
    },
    select: { id: true, name: true, email: true, role: true, area: true, status: true, createdAt: true },
  })

  // Generate invitation token
  const rawToken = uuidv4()
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

  await prisma.userInvitation.create({
    data: { id: uuidv4(), userId: user.id, tokenHash, expiresAt },
  })

  await sendInvitationEmail(email, name, rawToken)

  res.status(201).json({
    user,
    invitationLink: `${APP_URL}/accept-invitation?token=${rawToken}`,
  })
})

// ── PUT /users/:id (admin edits full profile) ─────────────────────────────────

usersRouter.put('/:id', isAdmin, async (req, res) => {
  const { name, email, role, area, joinedAt, bio, phone } = req.body
  const data: Record<string, unknown> = {}
  if (name)              data.name = name
  if (email)             data.email = email
  if (role)              data.role = role as Role
  if (area !== undefined) data.area = area || null
  if (joinedAt !== undefined) data.joinedAt = joinedAt ? new Date(joinedAt) : null
  if (bio !== undefined)  data.bio = bio || null
  if (phone !== undefined) data.phone = phone || null

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: { id: true, name: true, email: true, role: true, area: true, status: true, bio: true, phone: true, joinedAt: true, createdAt: true },
  })
  res.json(user)
})

// ── PATCH /users/:id (own profile fields) ────────────────────────────────────

usersRouter.patch('/:id', isAuth, async (req, res) => {
  const { userId, role } = req.user!
  const isOwn = userId === req.params.id
  if (!isOwn && role !== 'ADMIN') { res.status(403).json({ error: 'Sin permiso' }); return }

  const { bio, phone, name, whatsappNotif } = req.body
  const data: Record<string, unknown> = {}
  if (name)                       data.name          = name
  if (bio !== undefined)          data.bio           = bio || null
  if (phone !== undefined)        data.phone         = phone || null
  if (whatsappNotif !== undefined) data.whatsappNotif = Boolean(whatsappNotif)

  // Admin can also patch role/area/email/status via this route
  if (role === 'ADMIN') {
    const { email, area, joinedAt, newRole } = req.body
    if (email) data.email = email
    if (area !== undefined) data.area = area || null
    if (joinedAt !== undefined) data.joinedAt = joinedAt ? new Date(joinedAt) : null
    if (newRole) data.role = newRole as Role
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: { id: true, name: true, email: true, role: true, area: true, status: true, bio: true, phone: true, whatsappNotif: true, joinedAt: true, avatarUrl: true },
  })
  res.json(user)
})

// ── PATCH /users/:id/status ───────────────────────────────────────────────────

usersRouter.patch('/:id/status', isAdmin, async (req, res) => {
  const { status } = req.body
  if (!['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(status)) {
    res.status(400).json({ error: 'Estado inválido' }); return
  }

  // Admin can't suspend/deactivate themselves
  if (req.user!.userId === req.params.id && status !== 'ACTIVE') {
    res.status(400).json({ error: 'No puedes suspenderte o darte de baja a ti mismo' }); return
  }

  // Ensure at least one active admin remains
  if (status !== 'ACTIVE') {
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } })
    if (target?.role === 'ADMIN') {
      const activeAdmins = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } })
      if (activeAdmins <= 1) {
        res.status(400).json({ error: 'Debe haber al menos un administrador activo en el sistema' }); return
      }
    }
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { status: status as UserStatus },
    select: { id: true, name: true, status: true },
  })

  // Revoke all sessions if suspending or deactivating
  if (status !== 'ACTIVE') {
    await prisma.refreshToken.updateMany({
      where: { userId: req.params.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  res.json(user)
})

// ── POST /users/:id/resend-invitation ─────────────────────────────────────────

usersRouter.post('/:id/resend-invitation', isAdmin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, name: true, email: true, status: true } })
  if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return }
  if (user.status !== 'INVITED') { res.status(400).json({ error: 'El usuario ya activó su cuenta' }); return }

  // Delete old invitation and create new one
  await prisma.userInvitation.deleteMany({ where: { userId: user.id } })

  const rawToken = uuidv4()
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)
  await prisma.userInvitation.create({ data: { id: uuidv4(), userId: user.id, tokenHash, expiresAt } })
  await sendInvitationEmail(user.email, user.name, rawToken)

  res.json({ ok: true, invitationLink: `${APP_URL}/accept-invitation?token=${rawToken}` })
})

// ── PUT /users/:id/password ───────────────────────────────────────────────────

usersRouter.put('/:id/password', isAuth, async (req, res) => {
  if (req.user!.userId !== req.params.id) { res.status(403).json({ error: 'Solo puedes cambiar tu propia contraseña' }); return }
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) { res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' }); return }
  const pwSettings = await getSettings()
  const minLen = parseInt(pwSettings.password_min_length ?? '6', 10) || 6
  if (newPassword.length < minLen) { res.status(400).json({ error: `La nueva contraseña debe tener al menos ${minLen} caracteres` }); return }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
    res.status(401).json({ error: 'Contraseña actual incorrecta' }); return
  }

  const hashed = await bcrypt.hash(newPassword, 10)
  const currentJti = req.user!.jti

  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })

  // Revoke all sessions except current
  if (currentJti) {
    const currentHash = hashToken(currentJti)
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null, tokenHash: { not: currentHash } },
      data: { revokedAt: new Date() },
    })
  }

  res.json({ ok: true })
})

// ── GET /users/:id/sessions ───────────────────────────────────────────────────

usersRouter.get('/:id/sessions', isAuth, async (req, res) => {
  const { userId, role } = req.user!
  if (userId !== req.params.id && role !== 'ADMIN') { res.status(403).json({ error: 'Sin permiso' }); return }

  const sessions = await prisma.refreshToken.findMany({
    where: { userId: req.params.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })

  const currentJti = req.user!.jti
  res.json(sessions.map(s => ({
    id:          s.id,
    deviceInfo:  s.deviceInfo,
    ipAddress:   s.ipAddress,
    createdAt:   s.createdAt,
    expiresAt:   s.expiresAt,
    isCurrentSession: currentJti ? hashToken(currentJti) === s.tokenHash : false,
    relativeTime: relativeTime(s.createdAt),
  })))
})

// ── DELETE /users/:id/sessions (revoke all) ───────────────────────────────────

usersRouter.delete('/:id/sessions', isAuth, async (req, res) => {
  const { userId, role, jti } = req.user!
  if (userId !== req.params.id && role !== 'ADMIN') { res.status(403).json({ error: 'Sin permiso' }); return }

  const currentHash = jti ? hashToken(jti) : null
  await prisma.refreshToken.updateMany({
    where: {
      userId: req.params.id,
      revokedAt: null,
      ...(currentHash ? { tokenHash: { not: currentHash } } : {}),
    },
    data: { revokedAt: new Date() },
  })

  res.json({ ok: true })
})

// ── DELETE /sessions/:tokenId ─────────────────────────────────────────────────

usersRouter.delete('/sessions/:tokenId', isAuth, async (req, res) => {
  const session = await prisma.refreshToken.findUnique({ where: { id: req.params.tokenId } })
  if (!session) { res.status(404).json({ error: 'Sesión no encontrada' }); return }

  const { userId, role } = req.user!
  if (session.userId !== userId && role !== 'ADMIN') { res.status(403).json({ error: 'Sin permiso' }); return }

  await prisma.refreshToken.update({ where: { id: req.params.tokenId }, data: { revokedAt: new Date() } })
  res.json({ ok: true })
})

// ── GET /users/:id/permissions ────────────────────────────────────────────────

usersRouter.get('/:id/permissions', isAdmin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true } })
  if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return }

  const overrides = await prisma.userPermissionOverride.findMany({ where: { userId: req.params.id } })
  const overrideMap = new Map(overrides.map(o => [o.permission, o.granted]))
  const roleDefaults = new Set(ROLE_DEFAULTS[user.role] ?? [])

  const result = ALL_PERMISSIONS.map(p => ({
    permission: p,
    label:      PERMISSION_LABEL[p],
    module:     PERMISSION_MODULE[p],
    byRole:     roleDefaults.has(p),
    override:   overrideMap.has(p) ? overrideMap.get(p) : null,
    effective:  overrideMap.has(p) ? overrideMap.get(p) : roleDefaults.has(p),
  }))

  res.json(result)
})

// ── POST /users/:id/permissions ───────────────────────────────────────────────

usersRouter.post('/:id/permissions', isAdmin, async (req, res) => {
  const { permission, granted } = req.body
  if (!ALL_PERMISSIONS.includes(permission as Permission)) {
    res.status(400).json({ error: 'Permiso inválido' }); return
  }

  const override = await prisma.userPermissionOverride.upsert({
    where: { userId_permission: { userId: req.params.id, permission } },
    update: { granted, grantedById: req.user!.userId },
    create: { id: uuidv4(), userId: req.params.id, permission, granted, grantedById: req.user!.userId },
  })
  res.json(override)
})

// ── DELETE /users/:id/permissions/:permission ─────────────────────────────────

usersRouter.delete('/:id/permissions/:permission', isAdmin, async (req, res) => {
  await prisma.userPermissionOverride.deleteMany({
    where: { userId: req.params.id, permission: req.params.permission },
  })
  res.json({ ok: true })
})

// ── GET /skills ───────────────────────────────────────────────────────────────

usersRouter.get('/skills/all', isAuth, async (_req, res) => {
  const skills = await prisma.skill.findMany({ orderBy: { name: 'asc' } })
  res.json(skills)
})

// ── POST /users/:id/skills ────────────────────────────────────────────────────

usersRouter.post('/:id/skills', isAuth, async (req, res) => {
  const { userId, role } = req.user!
  if (userId !== req.params.id && role !== 'ADMIN') { res.status(403).json({ error: 'Sin permiso' }); return }

  const { name } = req.body
  if (!name?.trim()) { res.status(400).json({ error: 'Nombre de skill requerido' }); return }

  const skill = await prisma.skill.upsert({
    where: { name: name.trim().toLowerCase() },
    update: {},
    create: { id: uuidv4(), name: name.trim().toLowerCase() },
  })
  await prisma.userSkill.upsert({
    where: { userId_skillId: { userId: req.params.id, skillId: skill.id } },
    update: {},
    create: { userId: req.params.id, skillId: skill.id },
  })
  const skills = await prisma.skill.findMany({
    where: { users: { some: { userId: req.params.id } } },
    orderBy: { name: 'asc' },
  })
  res.json(skills)
})

// ── DELETE /users/:id/skills/:skillId ────────────────────────────────────────

usersRouter.delete('/:id/skills/:skillId', isAuth, async (req, res) => {
  const { userId, role } = req.user!
  if (userId !== req.params.id && role !== 'ADMIN') { res.status(403).json({ error: 'Sin permiso' }); return }

  await prisma.userSkill.deleteMany({ where: { userId: req.params.id, skillId: req.params.skillId } })
  res.json({ ok: true })
})

// ── POST /users/:id/avatar ────────────────────────────────────────────────────

usersRouter.post('/:id/avatar', isAuth, avatarUpload.single('avatar'), async (req, res) => {
  const { userId, role } = req.user!
  if (userId !== req.params.id && role !== 'ADMIN') { res.status(403).json({ error: 'Sin permiso' }); return }
  if (!req.file) { res.status(400).json({ error: 'Archivo requerido' }); return }

  const avatarUrl = `/api/avatars/${req.file.filename}`

  // Delete old avatar file if exists
  const prev = await prisma.user.findUnique({ where: { id: req.params.id }, select: { avatarUrl: true } })
  if (prev?.avatarUrl) {
    const oldFile = path.join(AVATAR_UPLOAD_DIR, path.basename(prev.avatarUrl))
    fs.unlink(oldFile, () => {})
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { avatarUrl },
    select: { id: true, avatarUrl: true },
  })
  res.json(user)
})
