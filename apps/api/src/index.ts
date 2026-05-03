import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import path from 'path'
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
import { sendTaskReminders } from './lib/taskRemindersJob'
import { getSettings } from './lib/settings'

const app = express()
const PORT = process.env.PORT || 4100

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://processa.hax.com.do']
    : ['http://localhost:3100', 'http://localhost:3000'],
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

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
