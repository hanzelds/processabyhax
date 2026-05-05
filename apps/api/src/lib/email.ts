import { Resend } from 'resend'
import { getSettings, emailEnabled } from './settings'

const resend = new Resend(process.env.RESEND_API_KEY)

async function getEmailConfig() {
  const s = await getSettings()
  return {
    FROM:    s.email_from || process.env.EMAIL_FROM || 'Processa by Hax <noreply@hax.com.do>',
    APP_URL: s.app_url    || process.env.APP_URL    || 'https://processa.hax.com.do',
  }
}

// Keep module-level constants as fallback for sync code that builds templates
const FROM    = process.env.EMAIL_FROM || 'Processa by Hax <noreply@hax.com.do>'
const APP_URL = process.env.APP_URL   || 'https://processa.hax.com.do'

// ── Shared template pieces ────────────────────────────────────────────────────

const EMAIL_WRAPPER_OPEN = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Processa · Hax</title></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f2f5;padding:40px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <!-- HEADER / LOGO -->
      <tr>
        <td style="background:#17394f;padding:32px 40px 28px;text-align:left;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:52px;font-weight:700;color:#ffffff;line-height:1;letter-spacing:-2px;margin:0;">hax</div>
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;font-weight:400;color:rgba(255,255,255,0.65);letter-spacing:4px;text-transform:lowercase;margin-top:4px;">estudio creativo</div>
              </td>
              <td style="padding-left:28px;border-left:1px solid rgba(255,255,255,0.2);vertical-align:middle;">
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;font-weight:600;color:rgba(255,255,255,0.5);letter-spacing:2px;text-transform:uppercase;">Processa</div>
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:10px;color:rgba(255,255,255,0.35);letter-spacing:1px;margin-top:2px;">Sistema operativo interno</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- BODY -->
      <tr><td style="padding:40px 40px 0;">
`

const EMAIL_WRAPPER_CLOSE = `
      </td></tr>

      <!-- FOOTER -->
      <tr>
        <td style="padding:28px 40px 32px;border-top:1px solid #f1f5f9;margin-top:32px;">
          <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;color:#94a3b8;margin:0;line-height:1.6;">
            Processa es el sistema operativo interno de <strong style="color:#64748b;">Hax Estudio Creativo</strong>.<br>
            Si no esperabas este correo, puedes ignorarlo con seguridad.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body></html>
`

function btn(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
    <tr>
      <td style="background:#17394f;border-radius:10px;">
        <a href="${href}" style="display:inline-block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;padding:14px 32px;letter-spacing:0.3px;">${label} →</a>
      </td>
    </tr>
  </table>`
}

function card(rows: string[]): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin:20px 0 0;">
    <tr><td style="padding:20px 22px;">
      ${rows.join('')}
    </td></tr>
  </table>`
}

function cardRow(label: string, value: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
    <tr>
      <td width="110" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;vertical-align:top;padding-top:1px;">${label}</td>
      <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#1e293b;font-weight:500;">${value}</td>
    </tr>
  </table>`
}

function h1(text: string): string {
  return `<h2 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:22px;font-weight:700;color:#0f172a;margin:0 0 10px;line-height:1.3;">${text}</h2>`
}

function p(text: string): string {
  return `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;color:#475569;line-height:1.7;margin:0 0 4px;">${text}</p>`
}

function linkFallback(url: string): string {
  return `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;color:#cbd5e1;margin:12px 0 0;word-break:break-all;line-height:1.5;">${url}</p>`
}

// ── Send invitation ───────────────────────────────────────────────────────────

export async function sendInvitationEmail(to: string, name: string, token: string): Promise<void> {
  const cfg = await getEmailConfig()
  const link = `${cfg.APP_URL}/accept-invitation?token=${token}`

  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL] Invitation for ${name} (${to})\nLink: ${link}`)
    return
  }
  if (!await emailEnabled()) return

  const html = EMAIL_WRAPPER_OPEN
    + h1(`Hola, ${name.split(' ')[0]} 👋`)
    + p(`Fuiste invitado al sistema operativo interno de <strong style="color:#17394f;">Hax Estudio Creativo</strong>.`)
    + p(`Acepta la invitación y crea tu contraseña para comenzar.`)
    + btn(link, 'Activar mi cuenta')
    + `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#94a3b8;margin:16px 0 0;">Este enlace expira en <strong>72 horas</strong>.</p>`
    + linkFallback(link)
    + EMAIL_WRAPPER_CLOSE

  const { error } = await resend.emails.send({
    from: cfg.FROM, to,
    subject: 'Te invitaron a Processa · Hax Estudio Creativo',
    html,
  })
  if (error) console.error('[EMAIL] Invitation error:', error)
}

// ── Password reset ────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const cfg = await getEmailConfig()
  const link = `${cfg.APP_URL}/reset-password?token=${token}`

  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL] Password reset for ${name} (${to})\nLink: ${link}`)
    return
  }
  if (!await emailEnabled()) return

  const html = EMAIL_WRAPPER_OPEN
    + h1('Restablecer contraseña')
    + p(`Hola <strong style="color:#0f172a;">${name.split(' ')[0]}</strong>, recibimos una solicitud para cambiar tu contraseña en Processa.`)
    + p(`Si no fuiste tú, ignora este correo. Tu cuenta está segura.`)
    + btn(link, 'Cambiar contraseña')
    + `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#94a3b8;margin:16px 0 0;">Este enlace expira en <strong>1 hora</strong> y solo puede usarse una vez.</p>`
    + linkFallback(link)
    + EMAIL_WRAPPER_CLOSE

  const { error } = await resend.emails.send({
    from: cfg.FROM, to,
    subject: 'Recuperación de contraseña · Processa',
    html,
  })
  if (error) console.error('[EMAIL] Password reset error:', error)
}

// ── Task assigned ─────────────────────────────────────────────────────────────

export async function sendTaskAssignedEmail(params: {
  to: string
  recipientName: string
  assignerName: string
  taskTitle: string
  taskTypeLabel?: string | null
  projectName: string
  clientName: string
  dueDate?: Date | null
  projectId: string
}): Promise<void> {
  if (!await emailEnabled('notify_task_assigned')) return
  const cfg = await getEmailConfig()
  const { to, recipientName, assignerName, taskTitle, taskTypeLabel, projectName, clientName, dueDate, projectId } = params
  const link = `${cfg.APP_URL}/projects/${projectId}`

  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL] Task assigned → ${to}: "${taskTitle}" in ${projectName}`)
    return
  }

  const rows = [
    `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;font-weight:700;color:#0f172a;margin:0 0 16px;line-height:1.3;">${taskTitle}</p>`,
    cardRow('Proyecto', projectName),
    cardRow('Cliente', clientName),
    ...(taskTypeLabel ? [cardRow('Tipo', taskTypeLabel)] : []),
    ...(dueDate ? [cardRow('Fecha límite', dueDate.toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' }))] : []),
  ]

  const html = EMAIL_WRAPPER_OPEN
    + h1(`Hola, ${recipientName.split(' ')[0]} 👋`)
    + p(`<strong style="color:#17394f;">${assignerName}</strong> te asignó una nueva tarea en Processa:`)
    + card(rows)
    + btn(link, 'Ver en Processa')
    + EMAIL_WRAPPER_CLOSE

  const { error } = await resend.emails.send({
    from: cfg.FROM, to,
    subject: `Nueva tarea: ${taskTitle}`,
    html,
  })
  if (error) console.error('[EMAIL] Task assigned error:', error)
}

// ── Task status changed → notify admins ───────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  IN_REVIEW: 'En revisión',
  COMPLETED: 'Completada',
  BLOCKED: 'Bloqueada',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:     '#64748b',
  IN_PROGRESS: '#2563eb',
  IN_REVIEW:   '#7c3aed',
  COMPLETED:   '#059669',
  BLOCKED:     '#dc2626',
}

const STATUS_BG: Record<string, string> = {
  PENDING:     '#f1f5f9',
  IN_PROGRESS: '#eff6ff',
  IN_REVIEW:   '#f5f3ff',
  COMPLETED:   '#f0fdf4',
  BLOCKED:     '#fef2f2',
}

export async function sendTaskStatusChangedEmail(params: {
  adminEmails: string[]
  changerName: string
  taskTitle: string
  projectName: string
  clientName: string
  fromStatus: string
  toStatus: string
  projectId: string
}): Promise<void> {
  if (!await emailEnabled('notify_task_status')) return
  const cfg = await getEmailConfig()
  const { adminEmails, changerName, taskTitle, projectName, clientName, fromStatus, toStatus, projectId } = params
  if (adminEmails.length === 0) return

  const link       = `${cfg.APP_URL}/projects/${projectId}`
  const fromLabel  = STATUS_LABEL[fromStatus]  ?? fromStatus
  const toLabel    = STATUS_LABEL[toStatus]    ?? toStatus
  const toColor    = STATUS_COLOR[toStatus]    ?? '#64748b'
  const toBg       = STATUS_BG[toStatus]       ?? '#f1f5f9'
  const fromColor  = STATUS_COLOR[fromStatus]  ?? '#64748b'
  const fromBg     = STATUS_BG[fromStatus]     ?? '#f1f5f9'

  const statusArrow = `
    <table cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
      <tr>
        <td style="background:${fromBg};color:${fromColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;font-weight:600;padding:5px 14px;border-radius:20px;">${fromLabel}</td>
        <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;color:#cbd5e1;padding:0 10px;">→</td>
        <td style="background:${toBg};color:${toColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;font-weight:700;padding:5px 14px;border-radius:20px;">${toLabel}</td>
      </tr>
    </table>`

  const rows = [
    `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;font-weight:700;color:#0f172a;margin:0 0 16px;">${taskTitle}</p>`,
    cardRow('Proyecto', projectName),
    cardRow('Cliente', clientName),
    cardRow('Cambio por', changerName),
    statusArrow,
  ]

  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL] Status change → admins: "${taskTitle}" ${fromStatus} → ${toStatus}`)
    return
  }

  const html = EMAIL_WRAPPER_OPEN
    + h1('Estado de tarea actualizado')
    + p(`<strong style="color:#17394f;">${changerName}</strong> actualizó el estado de una tarea en <strong style="color:#0f172a;">${projectName}</strong>.`)
    + card(rows)
    + btn(link, 'Ver en Processa')
    + EMAIL_WRAPPER_CLOSE

  const { error } = await resend.emails.send({
    from: cfg.FROM, to: adminEmails,
    subject: `${taskTitle} → ${toLabel}`,
    html,
  })
  if (error) console.error('[EMAIL] Status change error:', error)
}

// ── Brief assigned ────────────────────────────────────────────────────────────

const BRIEF_ROLE_LABEL: Record<string, string> = {
  guionista: 'Guionista', productor: 'Productor', editor: 'Editor', copy: 'Copy',
}

export async function sendBriefAssignedEmail(params: {
  to: string; recipientName: string; assignerName: string;
  briefTitle: string; role: string; clientName: string;
}): Promise<void> {
  if (!await emailEnabled('notify_brief_assigned')) return
  if (!process.env.RESEND_API_KEY) return
  const cfg = await getEmailConfig()
  const { to, recipientName, assignerName, briefTitle, role, clientName } = params
  const link = `${cfg.APP_URL}/content/briefs`
  const html = EMAIL_WRAPPER_OPEN
    + h1(`Hola, ${recipientName.split(' ')[0]} 👋`)
    + p(`<strong style="color:#17394f;">${assignerName}</strong> te asignó a un brief de contenido como <strong>${BRIEF_ROLE_LABEL[role] ?? role}</strong>:`)
    + card([
        `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;font-weight:700;color:#0f172a;margin:0 0 16px;">${briefTitle}</p>`,
        cardRow('Cliente', clientName),
        cardRow('Tu rol', BRIEF_ROLE_LABEL[role] ?? role),
      ])
    + btn(link, 'Ver preproducción')
    + EMAIL_WRAPPER_CLOSE
  const { error } = await resend.emails.send({ from: cfg.FROM, to, subject: `Nueva asignación de contenido — ${briefTitle}`, html })
  if (error) console.error('[EMAIL] Brief assigned error:', error)
}

// ── Brief status changed ──────────────────────────────────────────────────────

const BRIEF_STATUS_LABEL: Record<string, string> = {
  idea: 'Idea', en_desarrollo: 'En desarrollo', revision_interna: 'Revisión interna',
  aprobacion_cliente: 'Aprobación del cliente', aprobado: 'Aprobado',
  en_produccion: 'En producción', entregado: 'Entregado', cancelado: 'Cancelado',
}

export async function sendBriefStatusEmail(params: {
  brief: { id: string; title: string; client: { name: string }; assignees: { user: { email: string; name: string; status?: string } }[] };
  status: string; actor: string;
}): Promise<void> {
  if (!await emailEnabled('notify_brief_status')) return
  if (!process.env.RESEND_API_KEY) return
  const cfg = await getEmailConfig()
  const { brief, status, actor } = params
  const link = `${cfg.APP_URL}/content/briefs`
  const label = BRIEF_STATUS_LABEL[status] ?? status

  let to: string[] = []
  if (status === 'revision_interna' || status === 'entregado') {
    const users = await (await import('../lib/prisma')).prisma.user.findMany({ where: { role: { in: ['ADMIN', 'LEAD'] }, status: 'ACTIVE' }, select: { email: true } })
    to = users.map(u => u.email)
  } else if (status === 'aprobacion_cliente') {
    const users = await (await import('../lib/prisma')).prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { email: true } })
    to = users.map(u => u.email)
  } else if (status === 'aprobado') {
    // Only notify assignees who have accepted their invitation
    to = brief.assignees.filter(a => !a.user.status || a.user.status === 'ACTIVE').map(a => a.user.email)
  }
  if (!to.length) return

  const html = EMAIL_WRAPPER_OPEN
    + h1(`Brief: ${label}`)
    + p(`<strong style="color:#17394f;">${actor}</strong> actualizó el estado del brief:`)
    + card([
        `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;font-weight:700;color:#0f172a;margin:0 0 16px;">${brief.title}</p>`,
        cardRow('Cliente', brief.client.name),
        cardRow('Nuevo estado', label),
      ])
    + btn(link, 'Ver en Processa')
    + EMAIL_WRAPPER_CLOSE
  const { error } = await resend.emails.send({ from: cfg.FROM, to, subject: `Brief ${label} — ${brief.title}`, html })
  if (error) console.error('[EMAIL] Brief status error:', error)
}

// ── Piece scheduled ───────────────────────────────────────────────────────────

export async function sendPieceScheduledEmail(params: {
  adminEmails: string[]; pieceTitle: string; clientName: string;
  scheduledDate: string; scheduledTime: string | null;
}): Promise<void> {
  if (!await emailEnabled('notify_piece_scheduled')) return
  if (!process.env.RESEND_API_KEY) return
  const cfg = await getEmailConfig()
  const { adminEmails, pieceTitle, clientName, scheduledDate, scheduledTime } = params
  if (!adminEmails.length) return
  const dateStr = new Date(scheduledDate).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })
  const html = EMAIL_WRAPPER_OPEN
    + h1('Pieza programada 📅')
    + p(`Una pieza fue programada en el calendario:`)
    + card([
        `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;font-weight:700;color:#0f172a;margin:0 0 16px;">${pieceTitle}</p>`,
        cardRow('Cliente', clientName),
        cardRow('Fecha', dateStr),
        ...(scheduledTime ? [cardRow('Hora', scheduledTime)] : []),
      ])
    + btn(`${APP_URL}/content/calendar`, 'Ver calendario')
    + EMAIL_WRAPPER_CLOSE
  const { error } = await resend.emails.send({ from: cfg.FROM, to: adminEmails, subject: `Programado — ${pieceTitle} · ${dateStr}`, html })
  if (error) console.error('[EMAIL] Piece scheduled error:', error)
}

// ── Piece published ───────────────────────────────────────────────────────────

export async function sendPiecePublishedEmail(params: {
  adminEmails: string[]; pieceTitle: string; clientName: string; publisherName: string;
}): Promise<void> {
  if (!await emailEnabled('notify_piece_published')) return
  if (!process.env.RESEND_API_KEY) return
  const cfg = await getEmailConfig()
  const { adminEmails, pieceTitle, clientName, publisherName } = params
  if (!adminEmails.length) return
  const html = EMAIL_WRAPPER_OPEN
    + h1('Contenido publicado ✅')
    + p(`<strong style="color:#17394f;">${publisherName}</strong> marcó una pieza como publicada:`)
    + card([
        `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;font-weight:700;color:#0f172a;margin:0 0 16px;">${pieceTitle}</p>`,
        cardRow('Cliente', clientName),
      ])
    + btn(`${APP_URL}/content/calendar`, 'Ver calendario')
    + EMAIL_WRAPPER_CLOSE
  const { error } = await resend.emails.send({ from: cfg.FROM, to: adminEmails, subject: `Publicado — ${pieceTitle}`, html })
  if (error) console.error('[EMAIL] Piece published error:', error)
}

// ── Copy alert (48h warning) ──────────────────────────────────────────────────

export async function sendCopyAlertEmail(params: {
  adminEmails: string[]; pieceTitle: string; clientName: string; scheduledDate: string;
}): Promise<void> {
  if (!await emailEnabled('notify_copy_alert')) return
  if (!process.env.RESEND_API_KEY) return
  const cfg = await getEmailConfig()
  const { adminEmails, pieceTitle, clientName, scheduledDate } = params
  if (!adminEmails.length) return
  const dateStr = new Date(scheduledDate).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })
  const html = EMAIL_WRAPPER_OPEN
    + h1('⚠️ Copy pendiente — publicación en 48h')
    + p(`Esta pieza se publica en menos de 48 horas y su copy aún está <strong style="color:#d97706;">pendiente</strong>:`)
    + card([
        `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;font-weight:700;color:#0f172a;margin:0 0 16px;">${pieceTitle}</p>`,
        cardRow('Cliente', clientName),
        cardRow('Publicación', dateStr),
        cardRow('Copy', '<span style="color:#d97706;font-weight:700;">Pendiente ⚠️</span>'),
      ])
    + btn(`${APP_URL}/content/calendar`, 'Ver en calendario')
    + EMAIL_WRAPPER_CLOSE
  const { error } = await resend.emails.send({ from: cfg.FROM, to: adminEmails, subject: `⚠️ Copy pendiente — ${pieceTitle} se publica ${dateStr}`, html })
  if (error) console.error('[EMAIL] Copy alert error:', error)
}

// ── Portal de Cliente ─────────────────────────────────────────────────────────

export async function sendPortalLinkEmail(params: {
  to: string
  clientName: string
  month: string      // 'Junio 2025'
  portalUrl: string
}): Promise<void> {
  const cfg = await getEmailConfig()
  if (!await emailEnabled('email_portal_link')) return
  const { to, clientName, month, portalUrl } = params
  const html = EMAIL_WRAPPER_OPEN
    + h1(`Tu portal de contenido — ${month}`)
    + p(`Hola <strong>${clientName}</strong>,`)
    + p(`Tu equipo de Hax ha preparado el contenido del mes de <strong>${month}</strong>. Desde tu portal puedes revisar cada pieza, aprobar las que estén listas y solicitar ajustes con comentarios directos.`)
    + btn(portalUrl, 'Ver mi portal de contenido')
    + card([
        cardRow('Acceso', 'Sin contraseña — el link te da acceso directo'),
        cardRow('Válido', `Hasta fin de mes`),
        cardRow('Desde', 'Cualquier dispositivo, incluyendo tu teléfono'),
      ])
    + p(`Si el botón no funciona, copia este link en tu navegador:`)
    + linkFallback(portalUrl)
    + EMAIL_WRAPPER_CLOSE
  const { error } = await resend.emails.send({ from: cfg.FROM, to, subject: `Tu portal de contenido ${month} — Hax`, html })
  if (error) console.error('[EMAIL] Portal link error:', error)
}

export async function sendClientApprovedEmail(params: {
  adminEmails: string[]
  clientName: string
  pieceName: string
  month: string
  portalUrl: string
}): Promise<void> {
  const cfg = await getEmailConfig()
  if (!await emailEnabled('email_portal_approval')) return
  const { adminEmails, clientName, pieceName, month, portalUrl } = params
  if (!adminEmails.length) return
  const html = EMAIL_WRAPPER_OPEN
    + h1('✅ Aprobación recibida del cliente')
    + p(`<strong>${clientName}</strong> ha aprobado una pieza de contenido desde su portal:`)
    + card([
        cardRow('Pieza', pieceName),
        cardRow('Cliente', clientName),
        cardRow('Mes', month),
        cardRow('Estado', '<span style="color:#16a34a;font-weight:700;">Aprobado ✓</span>'),
      ])
    + btn(portalUrl, 'Ver en Processa')
    + EMAIL_WRAPPER_CLOSE
  const { error } = await resend.emails.send({ from: cfg.FROM, to: adminEmails, subject: `✅ ${clientName} aprobó — ${pieceName}`, html })
  if (error) console.error('[EMAIL] Client approved error:', error)
}

export async function sendClientChangesEmail(params: {
  adminEmails: string[]
  clientName: string
  pieceName: string
  changeType: string | null
  feedback: string | null
  month: string
  portalUrl: string
}): Promise<void> {
  const cfg = await getEmailConfig()
  if (!await emailEnabled('email_portal_changes')) return
  const { adminEmails, clientName, pieceName, changeType, feedback, month, portalUrl } = params
  if (!adminEmails.length) return
  const changeLabels: Record<string, string> = {
    copy: 'Copy / Caption', design: 'Diseño visual', date: 'Fecha u hora',
    concept: 'Idea / Concepto', other: 'Otro',
  }
  const changeLabel = changeType ? (changeLabels[changeType] ?? changeType) : null
  const html = EMAIL_WRAPPER_OPEN
    + h1('✏️ Cambios solicitados por el cliente')
    + p(`<strong>${clientName}</strong> ha solicitado ajustes en una pieza de contenido:`)
    + card([
        cardRow('Pieza', pieceName),
        cardRow('Cliente', clientName),
        cardRow('Mes', month),
        ...(changeLabel ? [cardRow('Tipo de cambio', `<strong>${changeLabel}</strong>`)] : []),
        ...(feedback ? [cardRow('Comentario', `<em style="color:#374151;">"${feedback}"</em>`)] : []),
      ])
    + btn(portalUrl, 'Ver en Processa')
    + EMAIL_WRAPPER_CLOSE
  const { error } = await resend.emails.send({ from: cfg.FROM, to: adminEmails, subject: `✏️ ${clientName} solicitó cambios — ${pieceName}`, html })
  if (error) console.error('[EMAIL] Client changes error:', error)
}

export async function sendPortalExpiryReminderEmail(params: {
  to: string
  clientName: string
  month: string
  portalUrl: string
  pendingCount: number
  daysLeft: number
}): Promise<void> {
  const cfg = await getEmailConfig()
  if (!await emailEnabled('email_portal_expiry')) return
  const { to, clientName, month, portalUrl, pendingCount, daysLeft } = params
  const html = EMAIL_WRAPPER_OPEN
    + h1(`⏰ Tu portal vence en ${daysLeft} días`)
    + p(`Hola <strong>${clientName}</strong>,`)
    + p(`Tu portal de contenido de <strong>${month}</strong> vence pronto y todavía tienes <strong>${pendingCount} pieza${pendingCount !== 1 ? 's' : ''}</strong> esperando tu revisión.`)
    + btn(portalUrl, 'Revisar contenido ahora')
    + card([
        cardRow('Pendientes', `${pendingCount} pieza${pendingCount !== 1 ? 's' : ''} sin aprobar`),
        cardRow('Vence en', `${daysLeft} días`),
      ])
    + EMAIL_WRAPPER_CLOSE
  const { error } = await resend.emails.send({ from: cfg.FROM, to, subject: `⏰ Tu portal vence en ${daysLeft} días — ${pendingCount} piezas pendientes`, html })
  if (error) console.error('[EMAIL] Portal expiry reminder error:', error)
}

export async function sendAllApprovedEmail(params: {
  adminEmails: string[]
  clientName: string
  month: string
  totalPieces: number
}): Promise<void> {
  const cfg = await getEmailConfig()
  if (!await emailEnabled('email_portal_all_approved')) return
  const { adminEmails, clientName, month, totalPieces } = params
  if (!adminEmails.length) return
  const html = EMAIL_WRAPPER_OPEN
    + h1('🎉 Todo el contenido aprobado')
    + p(`<strong>${clientName}</strong> ha aprobado todas las piezas de <strong>${month}</strong>.`)
    + card([
        cardRow('Cliente', clientName),
        cardRow('Mes', month),
        cardRow('Piezas aprobadas', `${totalPieces} en total`),
        cardRow('Estado', '<span style="color:#16a34a;font-weight:700;">✓ Cierre mensual completo</span>'),
      ])
    + EMAIL_WRAPPER_CLOSE
  const { error } = await resend.emails.send({ from: cfg.FROM, to: adminEmails, subject: `🎉 ${clientName} — todo aprobado en ${month}`, html })
  if (error) console.error('[EMAIL] All approved error:', error)
}

// ── Brief Comments ─────────────────────────────────────────────────────────────

type BriefRef   = { id: string; title: string; client: { name: string } }
type CommentRef = { id: string; content: string }
type UserRef    = { email: string; name: string }

function commentQuote(content: string): string {
  const snippet = content.length > 300 ? content.slice(0, 300) + '…' : content
  return `<blockquote style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #17394f;border-radius:0 8px 8px 0;">
    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#475569;line-height:1.6;margin:0;">${snippet.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}</p>
  </blockquote>`
}

export async function sendCommentNewEmail(params: {
  brief: BriefRef; comment: CommentRef; actorName: string
  recipients: UserRef[]
}): Promise<void> {
  if (!await emailEnabled('notify_brief_comment')) return
  if (!process.env.RESEND_API_KEY || !params.recipients.length) return
  const cfg = await getEmailConfig()
  const { brief, comment, actorName, recipients } = params
  const link = `${cfg.APP_URL}/content/briefs`
  const to = recipients.map(r => r.email)
  const html = EMAIL_WRAPPER_OPEN
    + h1(`Nuevo comentario en "${brief.title}"`)
    + p(`<strong style="color:#17394f;">${actorName}</strong> dejó un comentario:`)
    + commentQuote(comment.content)
    + card([cardRow('Brief', brief.title), cardRow('Cliente', brief.client.name)])
    + btn(link, 'Ver en Processa')
    + EMAIL_WRAPPER_CLOSE
  const { error } = await resend.emails.send({ from: cfg.FROM, to, subject: `Nuevo comentario en "${brief.title}"` , html })
  if (error) console.error('[EMAIL] Comment new error:', error)
}

export async function sendCommentMentionEmail(params: {
  brief: BriefRef; comment: CommentRef; actorName: string
  mentionedUsers: UserRef[]
}): Promise<void> {
  if (!await emailEnabled('notify_brief_comment')) return
  if (!process.env.RESEND_API_KEY || !params.mentionedUsers.length) return
  const cfg = await getEmailConfig()
  const { brief, comment, actorName, mentionedUsers } = params
  const link = `${cfg.APP_URL}/content/briefs`

  for (const user of mentionedUsers) {
    const html = EMAIL_WRAPPER_OPEN
      + h1(`Te mencionaron en "${brief.title}"`)
      + p(`<strong style="color:#17394f;">${actorName}</strong> te mencionó en un comentario:`)
      + commentQuote(comment.content)
      + card([cardRow('Brief', brief.title), cardRow('Cliente', brief.client.name)])
      + btn(link, 'Ver en Processa')
      + EMAIL_WRAPPER_CLOSE
    const { error } = await resend.emails.send({ from: cfg.FROM, to: user.email, subject: `Te mencionaron en "${brief.title}"`, html })
    if (error) console.error('[EMAIL] Comment mention error:', error)
  }
}

export async function sendCommentReplyEmail(params: {
  brief: BriefRef; comment: CommentRef; actorName: string; parentAuthor: UserRef
}): Promise<void> {
  if (!await emailEnabled('notify_brief_comment')) return
  if (!process.env.RESEND_API_KEY) return
  const cfg = await getEmailConfig()
  const { brief, comment, actorName, parentAuthor } = params
  const link = `${cfg.APP_URL}/content/briefs`
  const html = EMAIL_WRAPPER_OPEN
    + h1(`${actorName} respondió tu comentario`)
    + p(`Respondió a tu comentario en el brief <strong>${brief.title}</strong>:`)
    + commentQuote(comment.content)
    + card([cardRow('Brief', brief.title), cardRow('Cliente', brief.client.name)])
    + btn(link, 'Ver en Processa')
    + EMAIL_WRAPPER_CLOSE
  const { error } = await resend.emails.send({ from: cfg.FROM, to: parentAuthor.email, subject: `${actorName} respondió tu comentario en "${brief.title}"`, html })
  if (error) console.error('[EMAIL] Comment reply error:', error)
}

export async function sendCommentResolvedEmail(params: {
  brief: BriefRef; comment: CommentRef; actorName: string; commentAuthor: UserRef
}): Promise<void> {
  if (!await emailEnabled('notify_brief_comment')) return
  if (!process.env.RESEND_API_KEY) return
  const cfg = await getEmailConfig()
  const { brief, comment, actorName, commentAuthor } = params
  const link = `${cfg.APP_URL}/content/briefs`
  const html = EMAIL_WRAPPER_OPEN
    + h1(`Tu comentario fue marcado como resuelto`)
    + p(`<strong style="color:#17394f;">${actorName}</strong> marcó como resuelto tu comentario en <strong>${brief.title}</strong>:`)
    + commentQuote(comment.content)
    + btn(link, 'Ver en Processa')
    + EMAIL_WRAPPER_CLOSE
  const { error } = await resend.emails.send({ from: cfg.FROM, to: commentAuthor.email, subject: `Tu comentario en "${brief.title}" fue resuelto`, html })
  if (error) console.error('[EMAIL] Comment resolved error:', error)
}

export async function sendCommentOnStatusChangeEmail(params: {
  brief: BriefRef; comment: CommentRef; actorName: string
  newStatus: string; recipients: UserRef[]
}): Promise<void> {
  if (!await emailEnabled('notify_brief_comment')) return
  if (!process.env.RESEND_API_KEY || !params.recipients.length) return
  const cfg = await getEmailConfig()
  const { brief, comment, actorName, newStatus, recipients } = params
  const link = `${cfg.APP_URL}/content/briefs`
  const STATUS_LABEL: Record<string, string> = {
    revision_interna: 'Revisión interna', aprobacion_cliente: 'Aprobación cliente',
    aprobado: 'Aprobado', en_produccion: 'En producción',
  }
  const label = STATUS_LABEL[newStatus] ?? newStatus
  const to = recipients.map(r => r.email)
  const html = EMAIL_WRAPPER_OPEN
    + h1(`${actorName} dejó una nota al mover a "${label}"`)
    + p(`El brief <strong>${brief.title}</strong> fue movido a <strong>${label}</strong> con la siguiente nota:`)
    + commentQuote(comment.content)
    + card([cardRow('Brief', brief.title), cardRow('Cliente', brief.client.name), cardRow('Nuevo estado', label)])
    + btn(link, 'Ver en Processa')
    + EMAIL_WRAPPER_CLOSE
  const { error } = await resend.emails.send({ from: cfg.FROM, to, subject: `Nota al mover "${brief.title}" a ${label}`, html })
  if (error) console.error('[EMAIL] Comment on status change error:', error)
}

export async function sendGenericEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  if (!await emailEnabled()) return
  const cfg = await getEmailConfig()
  const wrapped = EMAIL_WRAPPER_OPEN + params.html + EMAIL_WRAPPER_CLOSE
  const { error } = await resend.emails.send({ from: cfg.FROM, to: params.to, subject: params.subject, html: wrapped })
  if (error) console.error('[EMAIL] Generic email error:', error)
}
