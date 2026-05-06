import { Router } from 'express'
import { google } from 'googleapis'
import { prisma } from '../lib/prisma'
import { isAuth, isAdmin } from '../middleware/auth'
import multer from 'multer'
import { Readable } from 'stream'
import archiver from 'archiver'

export const driveRouter = Router()

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     ?? ''
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? ''
const REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI  ?? 'https://processa.hax.com.do/api/drive/callback'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })

function oauthClient() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
}

async function getAuthedClient() {
  const conn = await prisma.driveConnection.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!conn) return null
  const auth = oauthClient()
  auth.setCredentials({
    access_token:  conn.accessToken,
    refresh_token: conn.refreshToken,
    expiry_date:   Number(conn.expiryDate),
  })
  auth.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await prisma.driveConnection.update({
        where: { id: conn.id },
        data: { accessToken: tokens.access_token, expiryDate: BigInt(tokens.expiry_date ?? 0), updatedAt: new Date() },
      })
    }
  })
  return auth
}

// ── GET /api/drive/status ─────────────────────────────────────────────────────
driveRouter.get('/status', isAuth, async (_req, res) => {
  const conn = await prisma.driveConnection.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { connectedBy: { select: { id: true, name: true } } },
  })
  res.json({ connected: !!conn, connectedBy: conn?.connectedBy ?? null, connectedAt: conn?.createdAt ?? null })
})

// ── GET /api/drive/auth ───────────────────────────────────────────────────────
driveRouter.get('/auth', isAdmin, (req, res) => {
  const userId = (req as any).user!.userId
  const url = oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',
    state:       Buffer.from(userId).toString('base64'),
    scope: [
      'https://www.googleapis.com/auth/drive',
    ],
  })
  res.redirect(url)
})

// ── GET /api/drive/callback ───────────────────────────────────────────────────
driveRouter.get('/callback', async (req, res) => {
  const { code, state } = req.query
  if (!code || typeof code !== 'string') { res.status(400).send('Missing code'); return }
  try {
    const userId = state ? Buffer.from(state as string, 'base64').toString() : null
    if (!userId) { res.redirect('/drive?error=1'); return }
    const auth = oauthClient()
    const { tokens } = await auth.getToken(code)
    if (!tokens.access_token || !tokens.refresh_token) { res.redirect('/drive?error=1'); return }
    await prisma.driveConnection.deleteMany()
    await prisma.driveConnection.create({
      data: {
        id: `drv_${Date.now()}`, accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token, expiryDate: BigInt(tokens.expiry_date ?? 0),
        connectedById: userId,
      },
    })
    res.redirect('/drive?connected=1')
  } catch (err) {
    console.error('Drive OAuth error:', err)
    res.redirect('/drive?error=1')
  }
})

// ── DELETE /api/drive/disconnect ─────────────────────────────────────────────
driveRouter.delete('/disconnect', isAdmin, async (_req, res) => {
  await prisma.driveConnection.deleteMany()
  res.json({ ok: true })
})

// ── Pinned roots ──────────────────────────────────────────────────────────────
const PINNED_ROOTS = [
  { id: '18cFjnLi7F9bIFKgOFORbVGVfDeib8LaT', name: 'Clientes',    label: 'Mi unidad / Hax / Clientes',         isSharedDrive: false },
  { id: '1KLixoqE1gfk8dt26k2jpQBtTVz_JvY4p', name: 'Home of Hax', label: 'Mi unidad / Hax / Home of Hax',      isSharedDrive: false },
  { id: '0AAL0LeKkweYwUk9PVA',               name: 'Archivos Hax', label: 'Unidades compartidas / Archivos Hax', isSharedDrive: true  },
  { id: '1GxcW3VRFPpMJOFftFMUqozv4sC6LgsyT', name: 'Pendientes',  label: 'Mi unidad / Hax / Pendientes',       isSharedDrive: false },
]

driveRouter.get('/roots', isAuth, (_req, res) => res.json(PINNED_ROOTS))

// ── GET /api/drive/files ──────────────────────────────────────────────────────
driveRouter.get('/files', isAuth, async (req, res) => {
  const auth = await getAuthedClient()
  if (!auth) { res.status(403).json({ error: 'Drive no conectado' }); return }

  const { folderId = 'root' } = req.query
  const drive = google.drive({ version: 'v3', auth })
  const pinnedRoot = PINNED_ROOTS.find(r => r.id === folderId)
  const isSharedDrive = pinnedRoot?.isSharedDrive ?? false

  const listParams: any = {
    q: `'${folderId}' in parents and trashed = false`,
    pageSize: 100,
    fields: 'files(id,name,mimeType,size,modifiedTime,thumbnailLink,iconLink,webViewLink,parents)',
    orderBy: 'folder,name',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  }
  if (isSharedDrive) {
    listParams.driveId  = folderId as string
    listParams.corpora  = 'drive'
  }

  const response = await drive.files.list(listParams)
  res.json(response.data.files ?? [])
})

// ── GET /api/drive/files/:id ──────────────────────────────────────────────────
driveRouter.get('/files/:id', isAuth, async (req, res) => {
  const auth = await getAuthedClient()
  if (!auth) { res.status(403).json({ error: 'Drive no conectado' }); return }
  const drive = google.drive({ version: 'v3', auth })
  const file = await drive.files.get({
    fileId: req.params.id,
    fields: 'id,name,mimeType,size,modifiedTime,thumbnailLink,webViewLink,webContentLink,parents,description',
    supportsAllDrives: true,
  })
  res.json(file.data)
})

// ── GET /api/drive/files/:id/thumbnail ───────────────────────────────────────
driveRouter.get('/files/:id/thumbnail', isAuth, async (req, res) => {
  const auth = await getAuthedClient()
  if (!auth) { res.status(403).end(); return }
  try {
    const drive = google.drive({ version: 'v3', auth })
    const stream = await drive.files.get(
      { fileId: req.params.id, alt: 'media', supportsAllDrives: true } as any,
      { responseType: 'stream' }
    )
    res.setHeader('Content-Type', (stream.headers as any)['content-type'] ?? 'application/octet-stream')
    res.setHeader('Cache-Control', 'public, max-age=300')
    ;(stream.data as any).pipe(res)
  } catch { res.status(404).end() }
})

// ── GET /api/drive/files/:id/download ────────────────────────────────────────
driveRouter.get('/files/:id/download', isAuth, async (req, res) => {
  const auth = await getAuthedClient()
  if (!auth) { res.status(403).end(); return }
  try {
    const drive = google.drive({ version: 'v3', auth })
    const meta = await drive.files.get({
      fileId: req.params.id,
      fields: 'id,name,mimeType',
      supportsAllDrives: true,
    })
    const { name, mimeType } = meta.data

    // Google Workspace files: export as Office formats
    const EXPORT_MAP: Record<string, { mime: string; ext: string }> = {
      'application/vnd.google-apps.document':     { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
      'application/vnd.google-apps.spreadsheet':  { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
      'application/vnd.google-apps.presentation': { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx' },
    }
    const exportFormat = EXPORT_MAP[mimeType ?? '']

    let stream: any
    let contentType: string
    let filename: string

    if (exportFormat) {
      const exported = await drive.files.export(
        { fileId: req.params.id, mimeType: exportFormat.mime },
        { responseType: 'stream' }
      )
      stream = exported.data
      contentType = exportFormat.mime
      filename = `${name}.${exportFormat.ext}`
    } else {
      const downloaded = await drive.files.get(
        { fileId: req.params.id, alt: 'media', supportsAllDrives: true } as any,
        { responseType: 'stream' }
      )
      stream = downloaded.data
      contentType = (downloaded.headers as any)['content-type'] ?? 'application/octet-stream'
      filename = name ?? 'archivo'
    }

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    res.setHeader('Content-Type', contentType)
    stream.pipe(res)
  } catch (err) {
    console.error('Drive download error:', err)
    res.status(500).end()
  }
})

// ── POST /api/drive/files/upload ─────────────────────────────────────────────
driveRouter.post('/files/upload', isAuth, upload.array('files', 20), async (req, res) => {
  const auth = await getAuthedClient()
  if (!auth) { res.status(403).json({ error: 'Drive no conectado' }); return }

  const { folderId } = req.body
  if (!folderId) { res.status(400).json({ error: 'folderId requerido' }); return }

  const files = req.files as Express.Multer.File[]
  if (!files || files.length === 0) { res.status(400).json({ error: 'No se recibieron archivos' }); return }

  const drive = google.drive({ version: 'v3', auth })
  const uploaded: any[] = []

  for (const file of files) {
    const stream = Readable.from(file.buffer)
    const response = await drive.files.create({
      requestBody: { name: file.originalname, parents: [folderId] },
      media: { mimeType: file.mimetype, body: stream },
      fields: 'id,name,mimeType,size,modifiedTime,webViewLink',
      supportsAllDrives: true,
    })
    uploaded.push(response.data)
  }

  res.json(uploaded)
})

// ── GET /api/drive/search ─────────────────────────────────────────────────────
driveRouter.get('/search', isAuth, async (req, res) => {
  const auth = await getAuthedClient()
  if (!auth) { res.status(403).json({ error: 'Drive no conectado' }); return }
  const { q } = req.query
  if (!q) { res.json([]); return }
  const drive = google.drive({ version: 'v3', auth })
  const response = await drive.files.list({
    q: `name contains '${String(q).replace(/'/g, "\\'")}' and trashed = false`,
    pageSize: 30,
    fields: 'files(id,name,mimeType,size,modifiedTime,thumbnailLink,iconLink,webViewLink,parents)',
    orderBy: 'modifiedTime desc',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  res.json(response.data.files ?? [])
})

// ── POST /api/drive/files/zip ─────────────────────────────────────────────────
driveRouter.post('/files/zip', isAuth, async (req, res) => {
  const auth = await getAuthedClient()
  if (!auth) { res.status(403).json({ error: 'Drive no conectado' }); return }

  const { ids } = req.body as { ids?: string[] }
  if (!ids || ids.length === 0) { res.status(400).json({ error: 'ids requeridos' }); return }

  const drive = google.drive({ version: 'v3', auth })

  const EXPORT_MAP: Record<string, { mime: string; ext: string }> = {
    'application/vnd.google-apps.document':     { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
    'application/vnd.google-apps.spreadsheet':  { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       ext: 'xlsx' },
    'application/vnd.google-apps.presentation': { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx' },
  }

  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="archivos-drive.zip"`)

  const archive = archiver('zip', { zlib: { level: 5 } })
  archive.pipe(res)

  archive.on('error', (err) => {
    console.error('ZIP error:', err)
    if (!res.headersSent) res.status(500).end()
  })

  for (const id of ids) {
    try {
      const meta = await drive.files.get({ fileId: id, fields: 'id,name,mimeType', supportsAllDrives: true })
      const { name, mimeType } = meta.data
      const exportFmt = EXPORT_MAP[mimeType ?? '']

      let stream: any
      let filename: string

      if (exportFmt) {
        const exported = await drive.files.export(
          { fileId: id, mimeType: exportFmt.mime },
          { responseType: 'stream' }
        )
        stream = exported.data
        filename = `${name}.${exportFmt.ext}`
      } else {
        const downloaded = await drive.files.get(
          { fileId: id, alt: 'media', supportsAllDrives: true } as any,
          { responseType: 'stream' }
        )
        stream = downloaded.data
        filename = name ?? id
      }

      archive.append(stream, { name: filename })
      // wait for this entry to finish before fetching the next to avoid overwhelming Drive API
      await new Promise<void>((resolve, reject) => {
        stream.on('end', resolve)
        stream.on('error', reject)
      })
    } catch (err) {
      console.error(`ZIP: skipping ${id}:`, err)
    }
  }

  await archive.finalize()
})

// ── DELETE /api/drive/files/:id ──────────────────────────────────────────────
driveRouter.delete('/files/:id', isAdmin, async (req, res) => {
  const auth = await getAuthedClient()
  if (!auth) { res.status(403).json({ error: 'Drive no conectado' }); return }
  try {
    const drive = google.drive({ version: 'v3', auth })
    await drive.files.delete({ fileId: req.params.id, supportsAllDrives: true })
    res.json({ ok: true })
  } catch (err: any) {
    console.error('Drive delete error:', err)
    res.status(err?.code ?? 500).json({ error: 'No se pudo eliminar el archivo' })
  }
})

// ── GET /api/drive/breadcrumb/:id ─────────────────────────────────────────────
driveRouter.get('/breadcrumb/:id', isAuth, async (req, res) => {
  const auth = await getAuthedClient()
  if (!auth) { res.status(403).json({ error: 'Drive no conectado' }); return }
  const drive = google.drive({ version: 'v3', auth })
  const crumbs: { id: string; name: string }[] = []
  let currentId = req.params.id
  while (currentId && currentId !== 'root') {
    try {
      const file = await drive.files.get({ fileId: currentId, fields: 'id,name,parents', supportsAllDrives: true })
      crumbs.unshift({ id: file.data.id!, name: file.data.name! })
      currentId = file.data.parents?.[0] ?? ''
    } catch { break }
  }
  res.json(crumbs)
})
