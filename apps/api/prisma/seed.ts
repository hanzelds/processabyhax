import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: 'hanzel@hax.com.do' } })
  if (existing) {
    console.log('Admin ya existe, skipping seed')
    return
  }

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

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
