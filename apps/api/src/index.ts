import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import path from 'path'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { authRouter } from './routes/auth'
import { usersRouter, AVATAR_UPLOAD_DIR } from './routes/users'
import { clientsRouter } from './routes/clients'
import { projectsRouter } from './routes/projects'
import { tasksRouter } from './routes/tasks'
import { dashboardRouter } from './routes/dashboard'
import { projectFilesRouter } from './routes/projectFiles'
import { adminTasksRouter } from './routes/adminTasks'
import { teamspacesRouter } from './routes/teamspaces'
import { generateRecurringAdminTasks } from './lib/recurringTasksJob'
import { briefsRouter } from './routes/briefs'
import { briefFilesRouter } from './routes/briefFiles'
import { briefCommentsRouter } from './routes/briefComments'
import { contentCalendarRouter } from './routes/contentCalendar'
import { runContentAlerts } from './lib/contentAlertsJob'
import { systemSettingsRouter } from './routes/systemSettings'
import { portalRouter } from './routes/portal'
import { docsRouter } from './routes/docs'
import { driveRouter } from './routes/drive'
import scriptsRouter from './routes/scripts'
import { notificationsRouter } from './routes/notifications'
import { timeRouter } from './routes/time'
import { reportsRouter } from './routes/reports'
import { dayplanRouter } from './routes/dayplan'
import { gearRouter } from './routes/gear'
import { locationsRouter } from './routes/locations'
import { vehiclesRouter } from './routes/vehicles'
import { shootsRouter } from './routes/shoots'
import { servicesRouter } from './routes/services'
import { clientServicesRouter } from './routes/clientServices'
import { metaRouter } from './routes/meta'
import { credentialsRouter } from './routes/credentials'
import { sendTaskReminders } from './lib/taskRemindersJob'
import { getSettings } from './lib/settings'
import billingRouter from './routes/billing'
import { superAdminRouter } from './routes/superAdmin'

const app = express()
const PORT = process.env.PORT || 4100

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow static file serving
  contentSecurityPolicy: false, // API only, no HTML served
}))

// Stripe webhook needs raw body — applied only to this path, before global express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }))

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://processa.hax.com.do']
    : ['http://localhost:3100', 'http://localhost:3000'],
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

// Rate limiting — auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos, espera 15 minutos.' },
})
const portalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes.' },
})
app.use('/api/auth/login',           authLimiter)
app.use('/api/auth/forgot-password', authLimiter)
app.use('/api/auth/reset-password',  authLimiter)
app.use('/api/portal',               portalLimiter)

// Static: avatars
app.use('/api/avatars', express.static(AVATAR_UPLOAD_DIR))

// Maintenance mode: block all non-auth traffic for non-admins
app.use('/api', async (req, res, next) => {
  if (req.path.startsWith('/auth')) return next()
  if (req.path.startsWith('/portal')) return next()  // Portal público, sin auth
  const settings = await getSettings()
  if (settings.maintenance_mode !== 'true') return next()
  // Allow if JWT indicates admin (best-effort, errors fall through to 503)
  try {
    const token = req.cookies?.token
    if (token) {
      const { verifyToken } = await import('./middleware/auth')
      const decoded = verifyToken(token)
      if (decoded?.role === 'ADMIN') return next()
    }
  } catch {}
  res.status(503).json({ error: 'Sistema en mantenimiento. Por favor intenta más tarde.', maintenance: true })
})

app.use('/api/auth',        authRouter)
app.use('/api/users',       usersRouter)
app.use('/api/clients',     clientsRouter)
app.use('/api/projects',    projectsRouter)
app.use('/api/projects/:id/files', projectFilesRouter)
app.use('/api/tasks',       tasksRouter)
app.use('/api/dashboard',   dashboardRouter)
app.use('/api/admin/tasks', adminTasksRouter)
app.use('/api/teamspaces',      teamspacesRouter)
app.use('/api/briefs',                    briefsRouter)
app.use('/api/briefs/:id/files',          briefFilesRouter)
app.use('/api/briefs/:id/comments',       briefCommentsRouter)
app.use('/api/content',         contentCalendarRouter)
app.use('/api/admin/system',    systemSettingsRouter)
app.use('/api/portal',          portalRouter)
app.use('/api/docs',            docsRouter)
app.use('/api/drive',           driveRouter)
app.use('/api/scripts',         scriptsRouter)
app.use('/api/notifications',   notificationsRouter)
app.use('/api/time',           timeRouter)
app.use('/api/reports',        reportsRouter)
app.use('/api/day-plan',       dayplanRouter)
app.use('/api/gear',           gearRouter)
app.use('/api/locations',      locationsRouter)
app.use('/api/vehicles',       vehiclesRouter)
app.use('/api/shoots',         shootsRouter)
app.use('/api/services',      servicesRouter)
app.use('/api/clients',       clientServicesRouter)
app.use('/api/meta',          metaRouter)
app.use('/api/credentials',   credentialsRouter)
app.use('/api/billing',       billingRouter)
app.use('/api/super-admin',   superAdminRouter)

app.all('*', (_, res) => res.status(404).json({ error: 'Not found' }))

// ── Cron: generate recurring admin tasks daily at 07:00 ───────────────────────
function scheduleDailyAt7() {
  const now = new Date()
  const next = new Date(now)
  next.setHours(7, 0, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  const msUntil = next.getTime() - now.getTime()
  setTimeout(() => {
    generateRecurringAdminTasks().catch(console.error)
    runContentAlerts().catch(console.error)
    sendTaskReminders().catch(console.error)
    setInterval(() => {
      generateRecurringAdminTasks().catch(console.error)
      runContentAlerts().catch(console.error)
      sendTaskReminders().catch(console.error)
    }, 24 * 60 * 60 * 1000)
  }, msUntil)
}

app.listen(PORT, () => {
  console.log(`Processa API running on port ${PORT}`)
  scheduleDailyAt7()
})
