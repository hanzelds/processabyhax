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

  // Create session (jti-based)
  const jti = uuidv4()
  const tokenHash = hashToken(jti)
  const expiresAt = new Date(Date.now() + sessionMs)
  const deviceInfo = (req.headers['user-agent'] || '').substring(0, 255)
  const ipAddress  = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').substring(0, 45)

  await prisma.refreshToken.create({
    data: { id: uuidv4(), userId: user.id, tokenHash, deviceInfo, ipAddress, expiresAt },
  })

  const token = signToken({ userId: user.id, role: user.role, name: user.name, jti })
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    maxAge: sessionMs,
  })

  const permissions = await getEffectivePermissions(user.id, user.role)
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, area: user.area, status: user.status, avatarUrl: user.avatarUrl, permissions })
})

// ── POST /auth/logout ─────────────────────────────────────────────────────────

authRouter.post('/logout', async (req, res) => {
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
    select: { id: true, name: true, email: true, role: true, area: true, status: true, avatarUrl: true, bio: true, phone: true, whatsappNotif: true, joinedAt: true, lastSeenAt: true, createdAt: true },
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

  const APP_URL = process.env.APP_URL || 'https://processa.hax.com.do'
  res.json({ ok: true, resetLink: `${APP_URL}/reset-password?token=${rawToken}` })
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
