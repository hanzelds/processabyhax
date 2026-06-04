import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { isAdminOrLead } from '../middleware/auth'
import { encrypt, decrypt } from '../lib/encryption'

export const credentialsRouter = Router()

const CRED_SELECT = {
  id: true, clientId: true, username: true, notes: true,
  createdAt: true, updatedAt: true,
  client:  { select: { id: true, name: true, color: true } },
  addedBy: { select: { id: true, name: true } },
  // encryptedPassword and encryptedEmail are NEVER returned in list/detail
}

// ── GET / — list all credentials (no passwords) ──────────────────────────────
credentialsRouter.get('/', isAdminOrLead, async (req, res) => {
  const { clientId } = req.query
  const where = clientId ? { clientId: clientId as string } : {}

  const creds = await prisma.clientInstagramAccount.findMany({
    where,
    select: {
      ...CRED_SELECT,
      // Include a flag to know if email is set (without revealing it)
      encryptedEmail: true,
    },
    orderBy: [{ client: { name: 'asc' } }, { username: 'asc' }],
  })

  // Replace encryptedEmail with boolean hasEmail
  const response = creds.map(({ encryptedEmail, ...c }) => ({
    ...c,
    hasEmail: !!encryptedEmail,
  }))

  res.json(response)
})

// ── GET /:id/reveal — decrypt and return password (and email if set) ─────────
credentialsRouter.get('/:id/reveal', isAdminOrLead, async (req, res) => {
  const cred = await prisma.clientInstagramAccount.findUnique({
    where: { id: req.params.id },
    select: {
      id: true, clientId: true, username: true,
      encryptedPassword: true, encryptedEmail: true,
      client: { select: { id: true, name: true } },
    },
  })
  if (!cred) { res.status(404).json({ error: 'Credencial no encontrada' }); return }

  let password = ''
  let email: string | null = null
  try {
    password = decrypt(cred.encryptedPassword)
    if (cred.encryptedEmail) email = decrypt(cred.encryptedEmail)
  } catch {
    res.status(500).json({ error: 'Error al descifrar la contraseña' }); return
  }

  res.json({ id: cred.id, username: cred.username, password, email })
})

// ── POST / — create credential ────────────────────────────────────────────────
credentialsRouter.post('/', isAdminOrLead, async (req, res) => {
  const { clientId, username, password, email, notes } = req.body
  if (!clientId || !username?.trim() || !password) {
    res.status(400).json({ error: 'Cliente, usuario y contraseña son requeridos' }); return
  }

  // Check client exists
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } })
  if (!client) { res.status(404).json({ error: 'Cliente no encontrado' }); return }

  // Check duplicate
  const existing = await prisma.clientInstagramAccount.findUnique({
    where: { clientId_username: { clientId, username: username.trim() } },
    select: { id: true },
  })
  if (existing) { res.status(409).json({ error: 'Ya existe una cuenta con ese usuario para este cliente' }); return }

  let encryptedPassword: string
  let encryptedEmail: string | null = null
  try {
    encryptedPassword = encrypt(password)
    if (email?.trim()) encryptedEmail = encrypt(email.trim())
  } catch {
    res.status(500).json({ error: 'Error al cifrar la contraseña' }); return
  }

  const cred = await prisma.clientInstagramAccount.create({
    data: {
      clientId,
      username: username.trim(),
      encryptedPassword,
      encryptedEmail,
      notes: notes?.trim() || null,
      addedById: req.user!.userId,
    },
    select: { ...CRED_SELECT, encryptedEmail: true },
  })

  const { encryptedEmail: _e, ...response } = { ...cred, hasEmail: !!cred.encryptedEmail }
  res.status(201).json(response)
})

// ── PATCH /:id — update credential ───────────────────────────────────────────
credentialsRouter.patch('/:id', isAdminOrLead, async (req, res) => {
  const { username, password, email, notes } = req.body

  const existing = await prisma.clientInstagramAccount.findUnique({
    where: { id: req.params.id },
    select: { id: true, clientId: true, encryptedEmail: true },
  })
  if (!existing) { res.status(404).json({ error: 'Credencial no encontrada' }); return }

  const data: Record<string, unknown> = {}
  if (username?.trim())  data.username = username.trim()
  if (notes !== undefined) data.notes = notes?.trim() || null

  if (password?.trim()) {
    try { data.encryptedPassword = encrypt(password.trim()) }
    catch { res.status(500).json({ error: 'Error al cifrar la contraseña' }); return }
  }
  if (email !== undefined) {
    try { data.encryptedEmail = email?.trim() ? encrypt(email.trim()) : null }
    catch { res.status(500).json({ error: 'Error al cifrar el email' }); return }
  }

  const updated = await prisma.clientInstagramAccount.update({
    where: { id: req.params.id },
    data,
    select: { ...CRED_SELECT, encryptedEmail: true },
  })

  const { encryptedEmail: _e, ...response } = { ...updated, hasEmail: !!updated.encryptedEmail }
  res.json(response)
})

// ── DELETE /:id — delete credential ──────────────────────────────────────────
credentialsRouter.delete('/:id', isAdminOrLead, async (req, res) => {
  const existing = await prisma.clientInstagramAccount.findUnique({
    where: { id: req.params.id }, select: { id: true },
  })
  if (!existing) { res.status(404).json({ error: 'Credencial no encontrada' }); return }

  await prisma.clientInstagramAccount.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})
