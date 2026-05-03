import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { hasPermission, Permission } from '../lib/permissions'

export interface AuthPayload {
  userId: string
  role: 'ADMIN' | 'LEAD' | 'TEAM'
  name?: string
  jti?: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'processa-secret'

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
}

export function verifyToken(token: string): AuthPayload | null {
  try { return jwt.verify(token, JWT_SECRET) as AuthPayload } catch { return null }
}

export async function isAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'No autenticado' })
    return
  }
  let payload: AuthPayload
  try {
    payload = jwt.verify(token, JWT_SECRET) as AuthPayload
  } catch {
    res.status(401).json({ error: 'Token inválido' })
    return
  }

  // If token has a jti, validate it's not revoked in DB
  if (payload.jti) {
    const crypto = await import('crypto')
    const tokenHash = crypto.createHash('sha256').update(payload.jti).digest('hex')
    const session = await prisma.refreshToken.findUnique({ where: { tokenHash } })
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      res.status(401).json({ error: 'Sesión inválida o expirada' })
      return
    }
  }

  // Check user status
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { status: true } })
  if (!user || user.status !== 'ACTIVE') {
    res.status(401).json({ error: 'Cuenta suspendida o inactiva' })
    return
  }

  // Fire-and-forget lastSeenAt update
  prisma.user.update({ where: { id: payload.userId }, data: { lastSeenAt: new Date() } }).catch(() => {})

  req.user = payload
  next()
}

export function isAdmin(req: Request, res: Response, next: NextFunction): void {
  isAuth(req, res, () => {
    if (req.user?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Solo admins' })
      return
    }
    next()
  })
}

export function isAdminOrLead(req: Request, res: Response, next: NextFunction): void {
  isAuth(req, res, () => {
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'LEAD') {
      res.status(403).json({ error: 'Sin permiso para esta acción' })
      return
    }
    next()
  })
}

// Checks role defaults + DB overrides — supports per-user permission grants
export function requirePermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await isAuth(req, res, async () => {
      const allowed = await hasPermission(req.user!.userId, req.user!.role, permission)
      if (!allowed) {
        res.status(403).json({ error: 'Sin permiso para esta acción' })
        return
      }
      next()
    })
  }
}
