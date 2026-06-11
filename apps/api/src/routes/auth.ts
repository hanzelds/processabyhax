import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../lib/prisma'
import { isAuth, signToken } from '../middleware/auth'
import { getEffectivePermissions } from '../lib/permissions'
import { sendInvitationEmail, sendPasswordResetEmail } from '../lib/email'
import { getSettings } from '../lib/settings'

export const authRouter = Router()

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

// ── POST /auth/login ──────────────────────────────────────────────────────────

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) { res.status(400).json({ error: 'Email y contraseña requeridos' }); return }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ error: 'Credenciales incorrectas' }); return
  }
  if (user.status !== 'ACTIVE') {
    const msg = user.status === 'INVITED'    ? 'Debes activar tu cuenta primero. Revisa tu email.'
              : user.status === 'SUSPENDED'  ? 'Tu cuenta está suspendida. Contacta a un administrador.'
              : 'Tu cuenta está inactiva.'
    res.status(401).json({ error: msg }); return
  }

  const settings = await getSettings()
  const sessionDays = parseInt(settings.session_duration_days ?? '30', 10) || 30
  const maxSessions = parseInt(settings.max_sessions_per_user ?? '10', 10) || 10
  const sessionMs   = sessionDays * 24 * 60 * 60 * 1000

  // Enforce max sessions: revoke oldest if limit reached
  const activeSessions = await prisma.refreshToken.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'asc' },
  })
  if (activeSessions.length >= maxSessions) {
    const toRevoke = activeSessions.slice(0, activeSessions.length - maxSessions + 1)
    await prisma.refreshToken.updateMany({
      where: { id: { in: toRevoke.map(s => s.id) } },
      data: { revokedAt: new Date() },
    })
  }

  // Resolve organization context
  const orgMemberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    include: { organization: { select: { id: true, name: true, slug: true, plan: true, planStatus: true } } },
    orderBy: { joinedAt: 'asc' },
  })
  const activeOrg = orgMemberships.find(m => m.organizationId === user.activeOrganizationId) ?? orgMemberships[0]
  const effectiveRole = activeOrg?.role ?? user.role
  const organizationId = activeOrg?.organizationId
  const orgPlan = activeOrg?.organization.plan

  // Create session (jti-based)
  const jti = uuidv4()
  const tokenHash = hashToken(jti)
  const expiresAt = new Date(Date.now() + sessionMs)
  const deviceInfo = (req.headers['user-agent'] || '').substring(0, 255)
  const ipAddress  = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').substring(0, 45)

  await prisma.refreshToken.create({
    data: { id: uuidv4(), userId: user.id, tokenHash, deviceInfo, ipAddress, expiresAt },
  })

  const token = signToken({ userId: user.id, role: effectiveRole, name: user.name, jti, organizationId, orgPlan })
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    maxAge: sessionMs,
  })

  const permissions = await getEffectivePermissions(user.id, effectiveRole)
  res.json({
    id: user.id, name: user.name, email: user.email,
    role: effectiveRole, area: user.area, status: user.status, avatarUrl: user.avatarUrl,
    permissions, organizationId, orgPlan,
    organizations: orgMemberships.length > 1 ? orgMemberships.map(m => ({
      id: m.organizationId, name: m.organization.name, slug: m.organization.slug,
      plan: m.organization.plan, role: m.role,
    })) : undefined,
  })
})

// ── POST /auth/logout ─────────────────────────────────────────────────────────

authRouter.post('/logout', isAuth, async (req, res) => {
  const jti = req.user?.jti
  if (jti) {
    const tokenHash = hashToken(jti)
    await prisma.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } }).catch(() => {})
  }
  res.clearCookie('token')
  res.json({ ok: true })
})

// ── GET /auth/me ──────────────────────────────────────────────────────────────

authRouter.get('/me', isAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, name: true, email: true, role: true, area: true, status: true, avatarUrl: true, bio: true, joinedAt: true, lastSeenAt: true, createdAt: true, isSuperAdmin: true },
  })
  if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return }
  const permissions = await getEffectivePermissions(user.id, user.role)
  res.json({ ...user, permissions })
})

// ── POST /auth/forgot-password ────────────────────────────────────────────────

authRouter.post('/forgot-password', async (req, res) => {
  const { email } = req.body
  if (!email) { res.status(400).json({ error: 'Email requerido' }); return }

  const user = await prisma.user.findUnique({ where: { email } })
  // Always respond OK to prevent email enumeration
  if (!user || user.status !== 'ACTIVE') { res.json({ ok: true }); return }

  // Invalidate previous resets
  await prisma.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } })

  const rawToken = uuidv4()
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await prisma.passwordReset.create({
    data: { id: uuidv4(), userId: user.id, tokenHash, expiresAt },
  })

  await sendPasswordResetEmail(user.email, user.name, rawToken)

  res.json({ ok: true })
})

// ── POST /auth/reset-password ─────────────────────────────────────────────────

authRouter.post('/reset-password', async (req, res) => {
  const { token, password } = req.body
  if (!token || !password) { res.status(400).json({ error: 'Token y contraseña requeridos' }); return }

  const settings = await getSettings()
  const minLen = parseInt(settings.password_min_length ?? '6', 10) || 6
  if (password.length < minLen) {
    res.status(400).json({ error: `La contraseña debe tener al menos ${minLen} caracteres` }); return
  }

  const tokenHash = hashToken(token)
  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash } })
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    res.status(400).json({ error: 'Token inválido o expirado' }); return
  }

  const hashed = await bcrypt.hash(password, 10)
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { password: hashed } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    // Revoke all active sessions
    prisma.refreshToken.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ])

  res.json({ ok: true })
})

// ── POST /auth/accept-invitation ──────────────────────────────────────────────

authRouter.post('/accept-invitation', async (req, res) => {
  const { token, password } = req.body
  if (!token || !password) { res.status(400).json({ error: 'Token y contraseña requeridos' }); return }

  const settings = await getSettings()
  const minLen = parseInt(settings.password_min_length ?? '6', 10) || 6
  if (password.length < minLen) {
    res.status(400).json({ error: `La contraseña debe tener al menos ${minLen} caracteres` }); return
  }

  const tokenHash = hashToken(token)
  const invitation = await prisma.userInvitation.findUnique({ where: { tokenHash } })
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    res.status(400).json({ error: 'Invitación inválida o expirada' }); return
  }

  const hashed = await bcrypt.hash(password, 10)
  const [user] = await prisma.$transaction([
    prisma.user.update({ where: { id: invitation.userId }, data: { password: hashed, status: 'ACTIVE' }, select: { id: true, name: true, email: true } }),
    prisma.userInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
  ])

  res.json({ ok: true, user })
})

// ── POST /auth/switch-org ─────────────────────────────────────────────────────

authRouter.post('/switch-org', isAuth, async (req, res) => {
  const { organizationId } = req.body
  if (!organizationId) { res.status(400).json({ error: 'organizationId requerido' }); return }

  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: req.user!.userId } },
    include: { organization: { select: { id: true, name: true, slug: true, plan: true, planStatus: true } } },
  })
  if (!membership) { res.status(403).json({ error: 'No perteneces a esta organización' }); return }
  if (membership.organization.planStatus === 'SUSPENDED') {
    res.status(403).json({ error: 'Organización suspendida' }); return
  }

  await prisma.user.update({
    where: { id: req.user!.userId },
    data: { activeOrganizationId: organizationId },
  })

  const settings = await getSettings()
  const sessionDays = parseInt(settings.session_duration_days ?? '30', 10) || 30
  const sessionMs = sessionDays * 24 * 60 * 60 * 1000
  const jti = uuidv4()
  const tokenHash = hashToken(jti)
  await prisma.refreshToken.create({
    data: { id: uuidv4(), userId: req.user!.userId, tokenHash, expiresAt: new Date(Date.now() + sessionMs) },
  })
  // Revoke old token
  if (req.user!.jti) {
    const oldHash = (await import('crypto')).createHash('sha256').update(req.user!.jti).digest('hex')
    await prisma.refreshToken.updateMany({ where: { tokenHash: oldHash }, data: { revokedAt: new Date() } }).catch(() => {})
  }

  const { signToken: sign } = await import('../middleware/auth')
  const token = sign({
    userId: req.user!.userId, role: membership.role, name: req.user!.name, jti,
    organizationId: membership.organizationId, orgPlan: membership.organization.plan,
  })
  res.cookie('token', token, {
    httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'lax', maxAge: sessionMs,
  })
  res.json({ ok: true, organizationId, role: membership.role, orgPlan: membership.organization.plan })
})

// ── POST /auth/register-org ───────────────────────────────────────────────────

authRouter.post('/register-org', async (req, res) => {
  const { name, email, password, timezone } = req.body
  if (!name || !email || !password) {
    res.status(400).json({ error: 'Nombre, email y contraseña requeridos' }); return
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' }); return
  }

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) { res.status(409).json({ error: 'Este email ya está registrado' }); return }

  // Generate unique slug from org name
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  let slug = baseSlug
  let attempt = 1
  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${attempt++}`
  }

  const hashed = await bcrypt.hash(password, 10)
  const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  const org = await prisma.organization.create({
    data: {
      name, slug,
      plan: 'TRIAL', planStatus: 'ACTIVE',
      trialEndsAt: trialEnd,
      timezone: timezone || 'America/Santo_Domingo',
      maxUsers: 9999, maxClients: 9999, storageGb: 100,
    },
  })

  const user = await prisma.user.create({
    data: {
      name, email, password: hashed,
      role: 'ADMIN', status: 'ACTIVE',
      activeOrganizationId: org.id,
    },
  })

  await prisma.organizationMember.create({
    data: { organizationId: org.id, userId: user.id, role: 'ADMIN' },
  })

  const sessionMs = 30 * 24 * 60 * 60 * 1000
  const jti = uuidv4()
  const tokenHash = hashToken(jti)
  await prisma.refreshToken.create({
    data: { id: uuidv4(), userId: user.id, tokenHash, expiresAt: new Date(Date.now() + sessionMs) },
  })

  const token = signToken({ userId: user.id, role: 'ADMIN', name: user.name, jti, organizationId: org.id, orgPlan: 'TRIAL' })
  res.cookie('token', token, {
    httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'lax', maxAge: sessionMs,
  })

  res.status(201).json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: 'ADMIN' },
    organization: { id: org.id, name: org.name, slug: org.slug, plan: org.plan, trialEndsAt: org.trialEndsAt },
  })
})
