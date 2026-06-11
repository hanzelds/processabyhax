import { Request, Response, NextFunction } from 'express'

const PLAN_FEATURES: Record<string, string[]> = {
  TRIAL:      ['briefs', 'calendar', 'tasks', 'portal', 'credentials', 'scripts', 'docs', 'drive', 'meta', 'shoots', 'logistics', 'gear', 'reports'],
  STARTER:    ['briefs', 'calendar', 'tasks', 'portal', 'credentials'],
  GROWTH:     ['briefs', 'calendar', 'tasks', 'portal', 'credentials', 'scripts', 'docs', 'drive', 'meta'],
  STUDIO:     ['briefs', 'calendar', 'tasks', 'portal', 'credentials', 'scripts', 'docs', 'drive', 'meta', 'shoots', 'logistics', 'gear', 'reports'],
  ENTERPRISE: ['briefs', 'calendar', 'tasks', 'portal', 'credentials', 'scripts', 'docs', 'drive', 'meta', 'shoots', 'logistics', 'gear', 'reports', 'custom_domain', 'sla'],
}

export function orgCanAccess(plan: string | undefined, feature: string): boolean {
  if (!plan) return false
  return PLAN_FEATURES[plan]?.includes(feature) ?? false
}

export function requireFeature(feature: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const plan = req.user?.orgPlan ?? ''
    if (!orgCanAccess(plan, feature)) {
      res.status(403).json({ error: 'Esta función no está disponible en tu plan actual.', upgrade: true })
      return
    }
    next()
  }
}
