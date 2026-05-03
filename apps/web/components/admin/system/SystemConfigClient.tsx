'use client'

import { useState } from 'react'
import { SystemSettings, PermissionRow, SystemStats } from '@/types'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Settings, Mail, MessageCircle, Shield, BarChart3,
  Building2, Lock, Users, FolderKanban, FileText,
  CheckCircle, AlertCircle, Loader2, Check, X, Info,
  CheckSquare, Clapperboard, Wrench, Zap,
} from 'lucide-react'

// ── Shared primitives ─────────────────────────────────────────────────────────

type Tab = 'general' | 'seguridad' | 'usuarios' | 'proyectos' | 'tareas' | 'contenido' | 'email' | 'whatsapp' | 'sistema'

const TABS: { id: Tab; label: string; Icon: typeof Settings }[] = [
  { id: 'general',    label: 'General',     Icon: Settings      },
  { id: 'seguridad',  label: 'Seguridad',   Icon: Lock          },
  { id: 'usuarios',   label: 'Usuarios',    Icon: Users         },
  { id: 'proyectos',  label: 'Proyectos',   Icon: FolderKanban  },
  { id: 'tareas',     label: 'Tareas',      Icon: CheckSquare   },
  { id: 'contenido',  label: 'Contenido',   Icon: Clapperboard  },
  { id: 'email',      label: 'Email',       Icon: Mail          },
  { id: 'whatsapp',   label: 'WhatsApp',    Icon: MessageCircle },
  { id: 'sistema',    label: 'Sistema',     Icon: BarChart3     },
]

const INPUT = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/30 focus:border-[#17394f]/50 transition-colors bg-white disabled:bg-slate-50 disabled:text-slate-400'
const SELECT = INPUT + ' cursor-pointer'

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl',
      ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
    )}>
      {ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      {msg}
    </div>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

function Toggle({ checked, onChange, label, description, warn }: {
  checked: boolean; onChange: (v: boolean) => void
  label: string; description?: string; warn?: string
}) {
  return (
    <div className="py-2">
      <label className="flex items-center justify-between gap-4 cursor-pointer group">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">{label}</p>
          {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={cn(
            'relative shrink-0 rounded-full transition-colors duration-200',
            checked ? 'bg-[#17394f]' : 'bg-slate-200'
          )}
          style={{ height: '22px', width: '40px' }}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform duration-200',
              checked ? 'translate-x-[18px]' : 'translate-x-0'
            )}
            style={{ width: '18px', height: '18px' }}
          />
        </button>
      </label>
      {warn && checked && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{warn}
        </div>
      )}
    </div>
  )
}

function SaveRow({ toast, saving, onSave, disabled }: {
  toast: { msg: string; ok: boolean } | null
  saving: boolean
  onSave: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      {toast ? <Toast msg={toast.msg} ok={toast.ok} /> : <div />}
      <button
        onClick={onSave}
        disabled={saving || disabled}
        className="flex items-center gap-2 bg-[#17394f] hover:bg-[#17394f]/90 disabled:opacity-50 text-white text-sm font-medium rounded-xl px-4 py-2.5 transition-colors"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  )
}

function useForm(settings: SystemSettings, onSave: (u: Partial<SystemSettings>) => Promise<void>) {
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState<{ msg: string; ok: boolean } | null>(null)

  function flash(msg: string, ok: boolean) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }

  async function save(updates: Record<string, string>) {
    setSaving(true)
    try {
      await onSave(updates)
      flash('Configuración guardada', true)
    } catch { flash('Error al guardar', false) }
    finally { setSaving(false) }
  }

  return { saving, toast, save }
}

// ── General Tab ───────────────────────────────────────────────────────────────

function GeneralTab({ settings, onSave }: { settings: SystemSettings; onSave: (u: Partial<SystemSettings>) => Promise<void> }) {
  const [companyName, setCompanyName] = useState(settings.company_name ?? '')
  const [appUrl,      setAppUrl]      = useState(settings.app_url ?? '')
  const [emailFrom,   setEmailFrom]   = useState(settings.email_from ?? '')
  const [support,     setSupport]     = useState(settings.support_email ?? '')
  const [timezone,    setTimezone]    = useState(settings.timezone ?? 'America/Santo_Domingo')
  const { saving, toast, save }       = useForm(settings, onSave)

  const TIMEZONES = [
    'America/Santo_Domingo', 'America/New_York', 'America/Chicago',
    'America/Denver', 'America/Los_Angeles', 'America/Bogota',
    'America/Lima', 'America/Buenos_Aires', 'America/Sao_Paulo',
    'Europe/Madrid', 'Europe/London', 'UTC',
  ]

  return (
    <div className="space-y-4">
      <Section title="Identidad" description="Información pública del sistema">
        <Field label="Nombre del sistema">
          <input className={INPUT} value={companyName} onChange={e => setCompanyName(e.target.value)} />
        </Field>
        <Field label="URL de la aplicación" hint="Se usa en emails y notificaciones. Sin barra final.">
          <input className={INPUT} value={appUrl} onChange={e => setAppUrl(e.target.value)} placeholder="https://processa.hax.com.do" />
        </Field>
      </Section>

      <Section title="Email" description="Configuración del remitente de email">
        <Field label="Remitente" hint='Formato: "Nombre <email@dominio.com>"'>
          <input className={INPUT} value={emailFrom} onChange={e => setEmailFrom(e.target.value)} />
        </Field>
        <Field label="Email de soporte" hint="Aparece en emails como contacto de ayuda. Opcional.">
          <input className={INPUT} value={support} onChange={e => setSupport(e.target.value)} placeholder="soporte@empresa.com" />
        </Field>
      </Section>

      <Section title="Localización">
        <Field label="Zona horaria" hint="Afecta la visualización de fechas y el horario de recordatorios">
          <select className={SELECT} value={timezone} onChange={e => setTimezone(e.target.value)}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </Field>
      </Section>

      <SaveRow toast={toast} saving={saving} onSave={() => save({ company_name: companyName, app_url: appUrl, email_from: emailFrom, support_email: support, timezone })} />
    </div>
  )
}

// ── Seguridad Tab ─────────────────────────────────────────────────────────────

function SeguridadTab({ settings, onSave }: { settings: SystemSettings; onSave: (u: Partial<SystemSettings>) => Promise<void> }) {
  const [sessionDays,  setSessionDays]  = useState(settings.session_duration_days ?? '30')
  const [maxSessions,  setMaxSessions]  = useState(settings.max_sessions_per_user ?? '10')
  const [pwMin,        setPwMin]        = useState(settings.password_min_length ?? '6')
  const [maintenance,  setMaintenance]  = useState(settings.maintenance_mode === 'true')
  const { saving, toast, save } = useForm(settings, onSave)

  return (
    <div className="space-y-4">
      <Section title="Sesiones" description="Control de acceso y duración de sesiones">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Duración de sesión (días)" hint="Cuántos días permanece activa una sesión sin relogin">
            <input type="number" min="1" max="365" className={INPUT} value={sessionDays} onChange={e => setSessionDays(e.target.value)} />
          </Field>
          <Field label="Sesiones simultáneas máx. por usuario" hint="Al superar el límite se revoca la sesión más antigua">
            <input type="number" min="1" max="50" className={INPUT} value={maxSessions} onChange={e => setMaxSessions(e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Contraseñas">
        <Field label="Longitud mínima de contraseña" hint="Se aplica al cambiar contraseña y al aceptar invitaciones">
          <input type="number" min="4" max="32" className={INPUT} value={pwMin} onChange={e => setPwMin(e.target.value)} />
        </Field>
        <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-3 text-xs text-slate-500">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
          <div>
            <p>Las contraseñas se almacenan con hash bcrypt (factor 10). El cambio de contraseña invalida todas las otras sesiones activas del usuario.</p>
          </div>
        </div>
      </Section>

      <Section title="Mantenimiento" description="Bloquea el acceso a todos los usuarios excepto administradores">
        <div className="divide-y divide-slate-100">
          <Toggle
            checked={maintenance}
            onChange={setMaintenance}
            label="Modo mantenimiento"
            description="Retorna 503 a todos los endpoints para usuarios no administradores"
            warn="El sistema quedará inaccesible para tu equipo inmediatamente"
          />
        </div>
      </Section>

      <SaveRow toast={toast} saving={saving} onSave={() => save({
        session_duration_days: sessionDays,
        max_sessions_per_user: maxSessions,
        password_min_length: pwMin,
        maintenance_mode: maintenance ? 'true' : 'false',
      })} />
    </div>
  )
}

// ── Usuarios Tab ──────────────────────────────────────────────────────────────

function UsuariosTab({ settings, onSave }: { settings: SystemSettings; onSave: (u: Partial<SystemSettings>) => Promise<void> }) {
  const [requireArea,      setRequireArea]      = useState(settings.require_area === 'true')
  const [inviteOnly,       setInviteOnly]       = useState(settings.invite_only !== 'false')
  const [defaultRole,      setDefaultRole]      = useState(settings.default_user_role ?? 'TEAM')
  const [suspendAfterDays, setSuspendAfterDays] = useState(settings.user_suspension_after_days ?? '0')
  const { saving, toast, save } = useForm(settings, onSave)

  return (
    <div className="space-y-4">
      <Section title="Registro y acceso" description="Cómo pueden unirse nuevos usuarios al sistema">
        <div className="divide-y divide-slate-100">
          <Toggle
            checked={inviteOnly}
            onChange={setInviteOnly}
            label="Solo por invitación"
            description="Nuevos usuarios solo pueden acceder si un administrador los invita"
          />
          <Toggle
            checked={requireArea}
            onChange={setRequireArea}
            label="Área obligatoria"
            description="El área (Diseño, Copy, Producción, etc.) es requerida al crear un usuario"
          />
        </div>
      </Section>

      <Section title="Valores por defecto">
        <Field label="Rol por defecto de nuevos usuarios" hint="Se asigna automáticamente si no se especifica rol al crear">
          <select className={SELECT} value={defaultRole} onChange={e => setDefaultRole(e.target.value)}>
            <option value="TEAM">Team</option>
            <option value="LEAD">Lead</option>
            <option value="ADMIN">Admin</option>
          </select>
        </Field>
      </Section>

      <Section title="Inactividad automática" description="Suspender usuarios que no inician sesión por un período">
        <Field label="Suspender después de N días inactivos" hint="Ingresa 0 para desactivar. Verificación diaria a las 07:00.">
          <input type="number" min="0" max="365" className={INPUT} value={suspendAfterDays} onChange={e => setSuspendAfterDays(e.target.value)} />
        </Field>
        {parseInt(suspendAfterDays) > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Usuarios sin actividad por más de {suspendAfterDays} días serán suspendidos automáticamente
          </div>
        )}
      </Section>

      <SaveRow toast={toast} saving={saving} onSave={() => save({
        require_area: requireArea ? 'true' : 'false',
        invite_only: inviteOnly ? 'true' : 'false',
        default_user_role: defaultRole,
        user_suspension_after_days: suspendAfterDays,
      })} />
    </div>
  )
}

// ── Proyectos Tab ─────────────────────────────────────────────────────────────

function ProyectosTab({ settings, onSave }: { settings: SystemSettings; onSave: (u: Partial<SystemSettings>) => Promise<void> }) {
  const [teamSeeAll,      setTeamSeeAll]      = useState(settings.allow_team_see_all_projects === 'true')
  const [teamCreate,      setTeamCreate]      = useState(settings.allow_team_create_projects === 'true')
  const [requireDesc,     setRequireDesc]     = useState(settings.project_requires_description === 'true')
  const [requireClose,    setRequireClose]    = useState(settings.project_requires_estimated_close === 'true')
  const [autoComplete,    setAutoComplete]    = useState(settings.project_auto_complete === 'true')
  const { saving, toast, save } = useForm(settings, onSave)

  return (
    <div className="space-y-4">
      <Section title="Visibilidad para el equipo" description="Qué pueden ver los usuarios con rol Team">
        <div className="divide-y divide-slate-100">
          <Toggle
            checked={teamSeeAll}
            onChange={setTeamSeeAll}
            label="Team ve todos los proyectos"
            description="Si está desactivado, Team solo ve proyectos que tienen tareas asignadas a ellos"
          />
        </div>
      </Section>

      <Section title="Permisos de creación">
        <div className="divide-y divide-slate-100">
          <Toggle
            checked={teamCreate}
            onChange={setTeamCreate}
            label="Team puede crear proyectos"
            description="Permite a usuarios Team crear nuevos proyectos en el sistema"
          />
        </div>
      </Section>

      <Section title="Campos obligatorios al crear proyecto">
        <div className="divide-y divide-slate-100">
          <Toggle
            checked={requireDesc}
            onChange={setRequireDesc}
            label="Descripción obligatoria"
            description="Requiere texto en el campo descripción al crear un proyecto"
          />
          <Toggle
            checked={requireClose}
            onChange={setRequireClose}
            label="Fecha de cierre estimada obligatoria"
            description="Requiere una fecha de entrega estimada al crear un proyecto"
          />
        </div>
      </Section>

      <Section title="Automatizaciones">
        <div className="divide-y divide-slate-100">
          <Toggle
            checked={autoComplete}
            onChange={setAutoComplete}
            label="Completar proyecto automáticamente"
            description="Cuando todas las tareas de un proyecto se completan, el proyecto pasa a estado Completado"
          />
        </div>
      </Section>

      <SaveRow toast={toast} saving={saving} onSave={() => save({
        allow_team_see_all_projects: teamSeeAll ? 'true' : 'false',
        allow_team_create_projects:  teamCreate  ? 'true' : 'false',
        project_requires_description:      requireDesc  ? 'true' : 'false',
        project_requires_estimated_close:  requireClose ? 'true' : 'false',
        project_auto_complete:             autoComplete ? 'true' : 'false',
      })} />
    </div>
  )
}

// ── Tareas Tab ────────────────────────────────────────────────────────────────

function TareasTab({ settings, onSave }: { settings: SystemSettings; onSave: (u: Partial<SystemSettings>) => Promise<void> }) {
  const [dueDays,        setDueDays]        = useState(settings.default_task_due_days ?? '7')
  const [maxFile,        setMaxFile]        = useState(settings.max_file_size_mb ?? '100')
  const [requireType,    setRequireType]    = useState(settings.require_task_type === 'true')
  const [teamCreate,     setTeamCreate]     = useState(settings.allow_team_create_tasks === 'true')
  const [teamDelete,     setTeamDelete]     = useState(settings.allow_team_delete_tasks === 'true')
  const [teamReopen,     setTeamReopen]     = useState(settings.allow_team_reopen_tasks === 'true')
  const [autoAssign,     setAutoAssign]     = useState(settings.auto_assign_to_creator === 'true')
  const [kanbanDays,     setKanbanDays]     = useState(settings.kanban_completed_visible_days ?? '7')
  const { saving, toast, save } = useForm(settings, onSave)

  return (
    <div className="space-y-4">
      <Section title="Valores por defecto">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Días plazo por defecto" hint="Días hasta vencimiento al crear tarea sin fecha explícita">
            <input type="number" min="1" max="365" className={INPUT} value={dueDays} onChange={e => setDueDays(e.target.value)} />
          </Field>
          <Field label="Tamaño máximo de archivo (MB)" hint="Límite por archivo en uploads de proyectos">
            <input type="number" min="1" max="2048" className={INPUT} value={maxFile} onChange={e => setMaxFile(e.target.value)} />
          </Field>
        </div>
        <Field label="Días que se muestran tareas completadas en kanban" hint="Oculta tareas completadas más antiguas del kanban para mantenerlo limpio">
          <input type="number" min="1" max="90" className={INPUT} value={kanbanDays} onChange={e => setKanbanDays(e.target.value)} />
        </Field>
      </Section>

      <Section title="Campos y validación">
        <div className="divide-y divide-slate-100">
          <Toggle
            checked={requireType}
            onChange={setRequireType}
            label="Tipo de tarea obligatorio"
            description="Requiere clasificar cada tarea (Diseño, Copy, Edición, etc.) al crearla"
          />
          <Toggle
            checked={autoAssign}
            onChange={setAutoAssign}
            label="Auto-asignar al creador"
            description="Si no se especifica un asignado, la tarea se asigna automáticamente al usuario que la crea"
          />
        </div>
      </Section>

      <Section title="Permisos del rol Team" description="Qué acciones pueden realizar los usuarios con rol Team">
        <div className="divide-y divide-slate-100">
          <Toggle
            checked={teamCreate}
            onChange={setTeamCreate}
            label="Puede crear tareas"
            description="Team puede crear tareas (solo asignadas a sí mismo)"
          />
          <Toggle
            checked={teamDelete}
            onChange={setTeamDelete}
            label="Puede eliminar tareas"
            description="Team puede eliminar sus propias tareas asignadas"
          />
          <Toggle
            checked={teamReopen}
            onChange={setTeamReopen}
            label="Puede reabrir tareas completadas"
            description="Team puede reabrir tareas completadas que tenga asignadas"
          />
        </div>
      </Section>

      <SaveRow toast={toast} saving={saving} onSave={() => save({
        default_task_due_days:          dueDays,
        max_file_size_mb:               maxFile,
        require_task_type:              requireType  ? 'true' : 'false',
        allow_team_create_tasks:        teamCreate   ? 'true' : 'false',
        allow_team_delete_tasks:        teamDelete   ? 'true' : 'false',
        allow_team_reopen_tasks:        teamReopen   ? 'true' : 'false',
        auto_assign_to_creator:         autoAssign   ? 'true' : 'false',
        kanban_completed_visible_days:  kanbanDays,
      })} />
    </div>
  )
}

// ── Contenido Tab ─────────────────────────────────────────────────────────────

function ContenidoTab({ settings, onSave }: { settings: SystemSettings; onSave: (u: Partial<SystemSettings>) => Promise<void> }) {
  const [reminderDays,  setReminderDays]  = useState(settings.content_reminder_days_before ?? '1')
  const [copyDays,      setCopyDays]      = useState(settings.copy_alert_days_before ?? '2')
  const [publishTime,   setPublishTime]   = useState(settings.content_default_publish_time ?? '09:00')
  const { saving, toast, save } = useForm(settings, onSave)

  return (
    <div className="space-y-4">
      <Section title="Recordatorios de publicación" description="Cuándo se envían alertas automáticas sobre piezas de contenido">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Días antes para recordatorio de publicación" hint="Alerta enviada N días antes de la fecha programada">
            <input type="number" min="1" max="30" className={INPUT} value={reminderDays} onChange={e => setReminderDays(e.target.value)} />
          </Field>
          <Field label="Días antes para alerta de copy pendiente" hint="Si hay copy sin aprobar N días antes de publicación, se alerta">
            <input type="number" min="1" max="30" className={INPUT} value={copyDays} onChange={e => setCopyDays(e.target.value)} />
          </Field>
        </div>
        <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-3 text-xs text-slate-500">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
          <span>Las alertas se ejecutan diariamente a las 07:00. Afectan solo a piezas en estado <strong>Programado</strong>.</span>
        </div>
      </Section>

      <Section title="Publicación por defecto">
        <Field label="Hora de publicación por defecto" hint="Hora sugerida al programar nuevas piezas de contenido">
          <input type="time" className={INPUT} value={publishTime} onChange={e => setPublishTime(e.target.value)} />
        </Field>
      </Section>

      <SaveRow toast={toast} saving={saving} onSave={() => save({
        content_reminder_days_before:   reminderDays,
        copy_alert_days_before:         copyDays,
        content_default_publish_time:   publishTime,
      })} />
    </div>
  )
}

// ── Email Tab ─────────────────────────────────────────────────────────────────

const EMAIL_GROUPS = [
  {
    title: 'Tareas',
    items: [
      { key: 'notify_task_assigned', label: 'Tarea asignada',     description: 'Notifica al usuario cuando se le asigna una tarea' },
      { key: 'notify_task_status',   label: 'Cambio de estado',   description: 'Notifica a los admins cuando el estado de una tarea cambia' },
    ],
  },
  {
    title: 'Preproducción (Briefs)',
    items: [
      { key: 'notify_brief_assigned', label: 'Brief asignado',    description: 'Notifica al equipo cuando se asigna a un brief' },
      { key: 'notify_brief_status',   label: 'Cambio de estado',  description: 'Notifica cuando el estado del brief cambia' },
    ],
  },
  {
    title: 'Calendario de contenido',
    items: [
      { key: 'notify_piece_scheduled', label: 'Pieza programada', description: 'Recordatorio antes de la fecha de publicación' },
      { key: 'notify_piece_published', label: 'Pieza publicada',  description: 'Confirmación cuando una pieza se marca como publicada' },
      { key: 'notify_copy_alert',      label: 'Alerta de copy',   description: 'Avisa cuando una pieza programada tiene copy pendiente' },
    ],
  },
]

function EmailTab({ settings, onSave }: { settings: SystemSettings; onSave: (u: Partial<SystemSettings>) => Promise<void> }) {
  const [vals, setVals] = useState<Record<string, boolean>>(() => {
    const obj: Record<string, boolean> = { emails_enabled: settings.emails_enabled !== 'false' }
    EMAIL_GROUPS.flatMap(g => g.items).forEach(i => { obj[i.key] = settings[i.key] !== 'false' })
    return obj
  })
  const { saving, toast, save } = useForm(settings, onSave)
  const globalOff = !vals.emails_enabled

  const emailConfigured = settings.email_resend_configured === 'true' || settings.email_resend_configured === true as unknown as string

  function set(key: string, v: boolean) { setVals(prev => ({ ...prev, [key]: v })) }

  return (
    <div className="space-y-4">
      <Section title="Estado de la integración">
        <div className={cn(
          'flex items-center gap-3 rounded-xl px-4 py-3',
          emailConfigured ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'
        )}>
          {emailConfigured
            ? <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            : <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />}
          <div>
            <p className={cn('text-sm font-medium', emailConfigured ? 'text-emerald-700' : 'text-amber-700')}>
              {emailConfigured ? 'Resend API Key configurada' : 'RESEND_API_KEY no configurada'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Variable requerida: <code className="font-mono bg-white/60 px-1 rounded">RESEND_API_KEY</code> en <code className="font-mono bg-white/60 px-1 rounded">apps/api/.env</code>
            </p>
          </div>
        </div>
      </Section>

      <Section title="Canal de email">
        <Toggle
          checked={vals.emails_enabled}
          onChange={v => set('emails_enabled', v)}
          label="Notificaciones por email activas"
          description="Desactivar silencia todos los emails independientemente de la configuración individual"
        />
        {globalOff && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Emails desactivados globalmente. No se enviará ninguna notificación por email.
          </div>
        )}
      </Section>

      {EMAIL_GROUPS.map(group => (
        <Section key={group.title} title={group.title}>
          <div className={cn('divide-y divide-slate-100', globalOff && 'opacity-40 pointer-events-none')}>
            {group.items.map(item => (
              <Toggle
                key={item.key}
                checked={vals[item.key] ?? true}
                onChange={v => set(item.key, v)}
                label={item.label}
                description={item.description}
              />
            ))}
          </div>
        </Section>
      ))}

      <SaveRow toast={toast} saving={saving} onSave={() => {
        const updates: Record<string, string> = {}
        Object.entries(vals).forEach(([k, v]) => { updates[k] = v ? 'true' : 'false' })
        save(updates)
      }} />
    </div>
  )
}

// ── WhatsApp Tab ──────────────────────────────────────────────────────────────

const WA_ITEMS = [
  { key: 'whatsapp_notify_task_assigned', label: 'Tarea asignada',    description: 'Avisa al asignado cuando recibe una nueva tarea' },
  { key: 'whatsapp_notify_task_status',   label: 'Cambio de estado',  description: 'Notifica al asignado cuando alguien cambia el estado de su tarea' },
  { key: 'whatsapp_notify_due_soon',      label: 'Recordatorio 24h',  description: 'Avisa al asignado un día antes del vencimiento' },
  { key: 'whatsapp_notify_overdue',       label: 'Tarea vencida',     description: 'Alerta al asignado el día siguiente al vencimiento' },
]

function WhatsAppTab({ settings, onSave }: { settings: SystemSettings; onSave: (u: Partial<SystemSettings>) => Promise<void> }) {
  const configured = settings.whatsapp_token_configured === 'true' || settings.whatsapp_token_configured === true as unknown as string
  const [vals, setVals] = useState<Record<string, boolean>>(() => {
    const obj: Record<string, boolean> = { whatsapp_enabled: settings.whatsapp_enabled === 'true' }
    WA_ITEMS.forEach(i => { obj[i.key] = settings[i.key] !== 'false' })
    return obj
  })
  const { saving, toast, save } = useForm(settings, onSave)
  const globalOn = vals.whatsapp_enabled

  function set(key: string, v: boolean) { setVals(prev => ({ ...prev, [key]: v })) }

  return (
    <div className="space-y-4">
      <Section title="Estado de la integración" description="Las credenciales se configuran como variables de entorno">
        <div className={cn(
          'flex items-center gap-3 rounded-xl px-4 py-3',
          configured ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'
        )}>
          {configured
            ? <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            : <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />}
          <div>
            <p className={cn('text-sm font-medium', configured ? 'text-emerald-700' : 'text-amber-700')}>
              {configured ? 'Token y número de teléfono configurados' : 'Token o número de teléfono no configurados'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Requiere: <code className="font-mono bg-white/60 px-1 rounded">WHATSAPP_TOKEN</code> y <code className="font-mono bg-white/60 px-1 rounded">WHATSAPP_PHONE_NUMBER_ID</code>
            </p>
          </div>
        </div>
        {!configured && (
          <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-4 space-y-1.5">
            <p className="font-semibold text-slate-600">Cómo configurar:</p>
            <p>1. Crea una app en <strong>developers.facebook.com</strong> → producto WhatsApp Business</p>
            <p>2. Obtén el <strong>Access Token</strong> permanente y el <strong>Phone Number ID</strong></p>
            <p>3. Agrégalos a <code className="font-mono bg-white px-1 rounded">apps/api/.env</code>:</p>
            <pre className="bg-white rounded-lg p-2 font-mono border border-slate-200 mt-1 overflow-x-auto">
              {`WHATSAPP_TOKEN=EAAxxxxxxx\nWHATSAPP_PHONE_NUMBER_ID=12345678\nWHATSAPP_API_VERSION=v19.0`}
            </pre>
            <p>4. Reinicia: <code className="font-mono bg-white px-1 rounded">pm2 restart processa-api</code></p>
          </div>
        )}
      </Section>

      <Section title="Canal de WhatsApp">
        <Toggle
          checked={vals.whatsapp_enabled}
          onChange={v => set('whatsapp_enabled', v)}
          label="Notificaciones por WhatsApp activas"
          description="Desactivar silencia todos los mensajes de WhatsApp"
        />
        {!configured && globalOn && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            WhatsApp habilitado pero las credenciales no están configuradas. No se enviarán mensajes.
          </div>
        )}
      </Section>

      <Section title="Tipos de notificación">
        <div className={cn('divide-y divide-slate-100', !globalOn && 'opacity-40 pointer-events-none')}>
          {WA_ITEMS.map(item => (
            <Toggle key={item.key} checked={vals[item.key] ?? true} onChange={v => set(item.key, v)} label={item.label} description={item.description} />
          ))}
        </div>
      </Section>

      <Section title="Recordatorios automáticos">
        <div className="flex items-center gap-3 text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-3">
          <Zap className="w-4 h-4 text-green-500 shrink-0" />
          <span>Los recordatorios (24h antes y vencidas) se envían a las <strong>07:00</strong> diariamente. Configuración de días en la pestaña <strong>Contenido</strong>.</span>
        </div>
        <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
          Cada usuario puede desactivar su propio WhatsApp desde <strong>Configuración → Notificaciones</strong>. El teléfono debe estar en formato internacional (+1 809...).
        </div>
      </Section>

      <SaveRow toast={toast} saving={saving} onSave={() => {
        const updates: Record<string, string> = {}
        Object.entries(vals).forEach(([k, v]) => { updates[k] = v ? 'true' : 'false' })
        save(updates)
      }} />
    </div>
  )
}

// ── Sistema Tab ───────────────────────────────────────────────────────────────

const MODULE_ICON: Record<string, typeof Shield> = {
  'Usuarios':  Users,
  'Clientes':  Building2,
  'Proyectos': FolderKanban,
  'Tareas':    CheckSquare,
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof Users; label: string; value: number | string; sub?: string; color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium text-slate-600">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function SistemaTab({ stats, permissions }: { stats: SystemStats | null; permissions: PermissionRow[] }) {
  const [activeSection, setActiveSection] = useState<'stats' | 'permisos' | 'logs'>('stats')

  const completionPct = stats && stats.tasks.total > 0
    ? Math.round((stats.tasks.completed / stats.tasks.total) * 100)
    : 0

  const modules = Array.from(new Set(permissions.map(p => p.module)))

  return (
    <div className="space-y-4">
      {/* Sub-navigation */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {(['stats', 'permisos', 'logs'] as const).map(s => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize',
              activeSection === s ? 'bg-white text-[#17394f] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {s === 'stats' ? 'Estadísticas' : s === 'permisos' ? 'Permisos' : 'Actividad'}
          </button>
        ))}
      </div>

      {activeSection === 'stats' && stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard icon={Users}       label="Usuarios"    value={stats.users.total}   sub={`Admin: ${stats.users.byRole.ADMIN ?? 0} · Lead: ${stats.users.byRole.LEAD ?? 0} · Team: ${stats.users.byRole.TEAM ?? 0}`} color="bg-[#17394f]/10 text-[#17394f]" />
            <StatCard icon={Building2}   label="Clientes"    value={stats.clients.total} sub={`${stats.clients.active} activos`}   color="bg-blue-50 text-blue-600" />
            <StatCard icon={FolderKanban}label="Proyectos"   value={stats.projects.total}sub={`${stats.projects.active} en curso`}  color="bg-purple-50 text-purple-600" />
            <StatCard icon={CheckSquare} label="Tareas"      value={stats.tasks.total}   sub={`${completionPct}% completadas · ${stats.tasks.overdue} vencidas`} color="bg-emerald-50 text-emerald-600" />
            <StatCard icon={Clapperboard}label="Contenido"   value={stats.content.briefs}sub={`Briefs · ${stats.content.pieces} piezas`} color="bg-amber-50 text-amber-600" />
            <StatCard icon={Wrench}      label="Tareas admin"value={stats.adminTasks}    sub="Operativas internas"                 color="bg-slate-100 text-slate-600" />
          </div>
          <Section title="Progreso de tareas">
            <div className="flex justify-between text-xs text-slate-500 mb-2">
              <span>{stats.tasks.completed} completadas</span>
              <span>{stats.tasks.total} total</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
            </div>
            {stats.tasks.overdue > 0 && (
              <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2 mt-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {stats.tasks.overdue} tarea{stats.tasks.overdue !== 1 ? 's' : ''} vencida{stats.tasks.overdue !== 1 ? 's' : ''} en el sistema
              </div>
            )}
          </Section>
          <Section title="Distribución del equipo">
            <div className="grid grid-cols-3 gap-3">
              {(['ADMIN', 'LEAD', 'TEAM'] as const).map(role => {
                const count = stats.users.byRole[role] ?? 0
                const pct   = stats.users.total > 0 ? Math.round((count / stats.users.total) * 100) : 0
                return (
                  <div key={role} className="text-center p-4 bg-slate-50 rounded-xl">
                    <p className="text-2xl font-bold text-slate-800">{count}</p>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">{role === 'ADMIN' ? 'Administradores' : role === 'LEAD' ? 'Leads' : 'Team'}</p>
                    <p className="text-xs text-slate-400 mt-1">{pct}% del equipo</p>
                  </div>
                )
              })}
            </div>
          </Section>
        </>
      )}

      {activeSection === 'permisos' && (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
            Esta matriz muestra los permisos <strong>por defecto</strong> de cada rol. Para ajustar permisos individuales, edita el usuario desde <strong>Equipo → usuario → Permisos</strong>.
          </div>
          {modules.map(mod => {
            const rows = permissions.filter(p => p.module === mod)
            const Icon = MODULE_ICON[mod] ?? Shield
            return (
              <Section key={mod} title={mod}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 text-xs font-semibold text-slate-500 w-full">Permiso</th>
                        {(['ADMIN', 'LEAD', 'TEAM'] as const).map(role => (
                          <th key={role} className="text-center py-2 px-4 text-xs font-semibold text-slate-500 whitespace-nowrap">{role}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {rows.map(p => (
                        <tr key={p.permission} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 pr-4">
                            <span className="text-sm text-slate-700">{p.label}</span>
                            <span className="ml-2 text-[10px] text-slate-400 font-mono">{p.permission}</span>
                          </td>
                          {(['ADMIN', 'LEAD', 'TEAM'] as const).map(role => (
                            <td key={role} className="py-2.5 px-4 text-center">
                              {p.roles[role]
                                ? <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                                : <X className="w-4 h-4 text-slate-200 mx-auto" />}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )
          })}
        </>
      )}

      {activeSection === 'logs' && (
        <Section title="Retención de logs">
          <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-4 text-sm text-slate-600">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
            <div className="space-y-1">
              <p>El log de actividad del sistema está activo y registra todas las acciones de usuarios sobre tareas, proyectos y clientes.</p>
              <p className="text-xs text-slate-400">Configura la retención en el campo <strong>log_retention_days</strong> en la base de datos. La limpieza automática aún no está implementada.</p>
            </div>
          </div>
        </Section>
      )}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

interface Props {
  initialSettings: SystemSettings
  permissions: PermissionRow[]
  stats: SystemStats | null
}

export function SystemConfigClient({ initialSettings, permissions, stats }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [settings, setSettings]   = useState(initialSettings)

  async function handleSave(updates: Partial<SystemSettings>) {
    const updated = await api.patch<SystemSettings>('/api/admin/system/settings', updates)
    setSettings(updated)
  }

  return (
    <div>
      {/* Tabs — scrollable on mobile */}
      <div className="overflow-x-auto pb-1 mb-6">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit min-w-full sm:min-w-0">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                activeTab === id
                  ? 'bg-white text-[#17394f] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'general'   && <GeneralTab   settings={settings} onSave={handleSave} />}
      {activeTab === 'seguridad' && <SeguridadTab  settings={settings} onSave={handleSave} />}
      {activeTab === 'usuarios'  && <UsuariosTab   settings={settings} onSave={handleSave} />}
      {activeTab === 'proyectos' && <ProyectosTab  settings={settings} onSave={handleSave} />}
      {activeTab === 'tareas'    && <TareasTab     settings={settings} onSave={handleSave} />}
      {activeTab === 'contenido' && <ContenidoTab  settings={settings} onSave={handleSave} />}
      {activeTab === 'email'     && <EmailTab      settings={settings} onSave={handleSave} />}
      {activeTab === 'whatsapp'  && <WhatsAppTab   settings={settings} onSave={handleSave} />}
      {activeTab === 'sistema'   && <SistemaTab    stats={stats} permissions={permissions} />}
    </div>
  )
}
