import { prisma } from './prisma'

export const ALL_PERMISSIONS = [
  'users.read',
  'users.write',
  'users.manage',
  'clients.read',
  'clients.write',
  'clients.archive',
  'projects.read_all',
  'projects.read_assigned',
  'projects.write',
  'projects.close',
  'tasks.read_all',
  'tasks.read_assigned',
  'tasks.write',
  'tasks.move_own',
  'tasks.reassign',
  'dashboard.global',
  'dashboard.personal',
  'admin_tasks.access',
  'content.preproduccion',
  'content.calendar',
] as const

export type Permission = (typeof ALL_PERMISSIONS)[number]

export const PERMISSION_LABEL: Record<Permission, string> = {
  'users.read':             'Ver usuarios',
  'users.write':            'Crear / editar usuarios',
  'users.manage':           'Suspender / dar de baja usuarios',
  'clients.read':           'Ver clientes',
  'clients.write':          'Crear / editar clientes',
  'clients.archive':        'Archivar clientes',
  'projects.read_all':      'Ver todos los proyectos',
  'projects.read_assigned': 'Ver proyectos asignados',
  'projects.write':         'Crear / editar proyectos',
  'projects.close':         'Cerrar proyectos',
  'tasks.read_all':         'Ver todas las tareas',
  'tasks.read_assigned':    'Ver tareas asignadas',
  'tasks.write':            'Crear / editar tareas',
  'tasks.move_own':         'Mover estado de tareas propias',
  'tasks.reassign':         'Reasignar tareas',
  'dashboard.global':       'Dashboard global (métricas equipo)',
  'dashboard.personal':     'Dashboard personal',
  'admin_tasks.access':     'Tareas administrativas (exclusivo admin)',
  'content.preproduccion':  'Acceso a módulo de preproducción (briefs)',
  'content.calendar':       'Acceso a calendario de contenido',
}

export const PERMISSION_MODULE: Record<Permission, string> = {
  'users.read':             'Usuarios',
  'users.write':            'Usuarios',
  'users.manage':           'Usuarios',
  'clients.read':           'Clientes',
  'clients.write':          'Clientes',
  'clients.archive':        'Clientes',
  'projects.read_all':      'Proyectos',
  'projects.read_assigned': 'Proyectos',
  'projects.write':         'Proyectos',
  'projects.close':         'Proyectos',
  'tasks.read_all':         'Tareas',
  'tasks.read_assigned':    'Tareas',
  'tasks.write':            'Tareas',
  'tasks.move_own':         'Tareas',
  'tasks.reassign':         'Tareas',
  'dashboard.global':       'Dashboard',
  'dashboard.personal':     'Dashboard',
  'admin_tasks.access':     'Admin',
  'content.preproduccion':  'Contenido',
  'content.calendar':       'Contenido',
}

export const ROLE_DEFAULTS: Record<string, Permission[]> = {
  ADMIN: [
    'users.read', 'users.write', 'users.manage',
    'clients.read', 'clients.write', 'clients.archive',
    'projects.read_all', 'projects.read_assigned', 'projects.write', 'projects.close',
    'tasks.read_all', 'tasks.read_assigned', 'tasks.write', 'tasks.move_own', 'tasks.reassign',
    'dashboard.global', 'dashboard.personal',
    'admin_tasks.access',
    'content.preproduccion', 'content.calendar',
  ],
  LEAD: [
    'users.read',
    'clients.read', 'clients.write',
    'projects.read_all', 'projects.read_assigned', 'projects.write', 'projects.close',
    'tasks.read_all', 'tasks.read_assigned', 'tasks.write', 'tasks.move_own', 'tasks.reassign',
    'dashboard.global', 'dashboard.personal',
    'content.preproduccion', 'content.calendar',
  ],
  TEAM: [
    'projects.read_assigned',
    'tasks.read_assigned', 'tasks.move_own',
    'dashboard.personal',
  ],
}

export async function hasPermission(userId: string, role: string, permission: Permission): Promise<boolean> {
  const override = await prisma.userPermissionOverride.findUnique({
    where: { userId_permission: { userId, permission } },
  })
  if (override !== null) return override.granted
  return (ROLE_DEFAULTS[role] ?? []).includes(permission)
}

export async function getEffectivePermissions(userId: string, role: string): Promise<Permission[]> {
  const overrides = await prisma.userPermissionOverride.findMany({ where: { userId } })
  const overrideMap = new Map(overrides.map(o => [o.permission, o.granted]))
  return ALL_PERMISSIONS.filter(p => {
    if (overrideMap.has(p)) return overrideMap.get(p)
    return (ROLE_DEFAULTS[role] ?? []).includes(p)
  })
}
