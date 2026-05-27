import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEFAULT_SERVICES = [
  { name: 'Social Media Management', icon: '📱', color: '#ec4899', order: 0 },
  { name: 'Producción de Video',     icon: '🎬', color: '#8b5cf6', order: 1 },
  { name: 'Fotografía',              icon: '📸', color: '#f59e0b', order: 2 },
  { name: 'Real Estate Media',       icon: '🏠', color: '#14b8a6', order: 3 },
  { name: 'Estrategia de Contenido', icon: '📊', color: '#3b82f6', order: 4 },
  { name: 'Diseño Gráfico',          icon: '🎨', color: '#f43f5e', order: 5 },
  { name: 'Producción de Reels',     icon: '🎥', color: '#6366f1', order: 6 },
]

async function main() {
  // ── Admin user ────────────────────────────────────────────────────────────
  const existing = await prisma.user.findUnique({ where: { email: 'hanzel@hax.com.do' } })
  if (existing) {
    console.log('Admin ya existe, skipping user seed')
  } else {
    const hashed = await bcrypt.hash('Hax2025!', 10)
    await prisma.user.create({
      data: {
        name: 'Hanzel',
        email: 'hanzel@hax.com.do',
        password: hashed,
        role: Role.ADMIN,
        area: 'Dirección',
      },
    })
    console.log('Admin creado: hanzel@hax.com.do')
  }

  // ── Catálogo de servicios ─────────────────────────────────────────────────
  let created = 0
  for (const s of DEFAULT_SERVICES) {
    const exists = await prisma.service.findFirst({ where: { name: s.name } })
    if (!exists) {
      await prisma.service.create({ data: s })
      created++
    }
  }
  if (created > 0) console.log(`${created} servicio(s) creado(s)`)
  else console.log('Servicios ya existen, skipping')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
