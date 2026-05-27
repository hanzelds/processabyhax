import { Router } from 'express'
import { google } from 'googleapis'
import { prisma } from '../lib/prisma'
import { isAuth, isAdmin, isAdminOrLead } from '../middleware/auth'
import multer from 'multer'
import { Readable } from 'stream'
import archiver from 'archiver'
import fs from 'fs'
import os from 'os'
import path from 'path'

// ── MIME type fallback map for files browsers mis-identify ────────────────────
const EXT_MIME: Record<string, string> = {
  psd:  'image/vnd.adobe.photoshop',
  psb:  'image/vnd.adobe.photoshop',
  ai:   'application/postscript',
  eps:  'application/postscript',
  indd: 'application/x-indesign',
  svg:  'image/svg+xml',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
  avif: 'image/avif',
  tif:  'image/tiff',
  tiff: 'image/tiff',
}

function guessMimeByExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return EXT_MIME[ext] ?? 'application/octet-stream'
}

export const driveRouter = Router()

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     ?? ''
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? ''
const REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI  ?? 'https://processa.hax.com.do/api/drive/callback'

const UPLOAD_TMP = path.join(os.tmpdir(), 'processa-uploads')
fs.mkdirSync(UPLOAD_TMP, { recursive: true })

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_TMP),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`),
})

const upload = multer({ storage: diskStorage, limits: { fileSize: 4 * 1024 * 1024 * 1024 } }) // 4 GB max

// ── In-memory folder cache (60s TTL) ─────────────────────────────────────────
const CACHE_TTL = 60_000
const folderCache = new Map<string, { files: any[]; ts: number }>()
const folderNameCache = new Map<string, string>() // id → name, used for breadcrumb

function getCached(folderId: string): any[] | null {
  const entry = folderCache.get(folderId)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) { folderCache.delete(folderId); return null }
  return entry.files
}
function setCache(folderId: string, files: any[]) {
  folderCache.set(folderId, { files, ts: Date.now() })
  // Also cache folder names from the list
  for (const f of files) {
    if (f.mimeType === FOLDER_MIME && f.id && f.name) {
      folderNameCache.set(f.id, f.name)
    }
  }
}
function invalidateCache(folderId: string) { folderCache.delete(folderId) }
function invalidateAll() { folderCache.clear() }

const FOLDER_MIME = 'application/vnd.google-apps.folder'

// ── OAuth ─────────────────────────────────────────────────────────────────────

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
    invalidateAll()
    res.redirect('/drive?connected=1')
  } catch (err) {
    console.error('Drive OAuth error:', err)
    res.redirect('/drive?error=1')
  }
})

// ── DELETE /api/drive/disconnect ─────────────────────────────────────────────
driveRouter.delete('/disconnect', isAdmin, async (_req, res) => {
  await prisma.driveConnection.deleteMany()
  invalidateAll()
  res.json({ ok: true })
})

// ── Pinned roots ──────────────────────────────────────────────────────────────
const PINNED_ROOTS = [
  { id: '18cFjnLi7F9bIFKgOFORbVGVfDeib8LaT', name: 'Clientes',    label: 'Mi unidad / Hax / Clientes',         isSharedDrive: false },
  { id: '1KLixoqE1gfk8dt26k2jpQBtTVz_JvY4p', name: 'Home of Hax', label: 'Mi unidad / Hax / Home of Hax',      isSharedDrive: false },
  { id: '0AAL0LeKkweYwUk9PVA',               name: 'Archivos Hax', label: 'Unidades compartidas / Archivos Hax', isSharedDrive: true  },
  { id: '1GxcW3VRFPpMJOFftFMUqozv4sC6LgsyT', name: 'Pendientes',  label: 'Mi unidad / Hax / Pendientes',       isSharedDrive: false },
]

// Pre-populate root names
for (const r of PINNED_ROOTS) folderNameCache.set(r.id, r.name)

driveRouter.get('/roots', isAuth, (_req, res) => res.json(PINNED_ROOTS))

// ── GET /api/drive/files ──────────────────────────────────────────────────────
// Returns { files: DriveFile[], nextPageToken?: string }
driveRouter.get('/files', isAuth, async (req, res) => {
  const auth = await getAuthedClient()
  if (!auth) { res.status(403).json({ error: 'Drive no conectado' }); return }

  const { folderId = 'root', pageToken } = req.query as { folderId?: string; pageToken?: string }
  const isFirstPage = !pageToken

  // Return from cache only on first page (no pageToken)
  if (isFirstPage) {
    const cached = getCached(folderId)
    if (cached) {
      res.setHeader('X-Cache', 'HIT')
      res.json({ files: cached, nextPageToken: null })
      return
    }
  }

  const drive = google.drive({ version: 'v3', auth })
  const pinnedRoot = PINNED_ROOTS.find(r => r.id === folderId)
  const isSharedDrive = pinnedRoot?.isSharedDrive ?? false

  const listParams: any = {
    q: `'${folderId}' in parents and trashed = false`,
    pageSize: 100,
    fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,thumbnailLink,iconLink,webViewLink,parents)',
    orderBy: 'folder,name',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  }
  if (pageToken) listParams.pageToken = pageToken
  if (isSharedDrive) {
    listParams.driveId  = folderId
    listParams.corpora  = 'drive'
  }

  const response = await drive.files.list(listParams)
  const files = response.data.files ?? []
  const nextPageToken = response.data.nextPageToken ?? null

  // Only cache first-page results
  if (isFirstPage) setCache(folderId, files)

  res.json({ files, nextPageToken })
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
    // Thumbnails don't change unless the file is replaced — cache for 1 hour
    res.setHeader('Cache-Control', 'public, max-age=3600, immutable')
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

// ── Multer wrapper that swallows aborted-request errors ──────────────────────
function runUpload(req: any, res: any): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.any()(req, res, (err: any) => {
      if (!err) return resolve()
      if (
        err.message === 'Request aborted' ||
        err.code === 'ECONNABORTED' ||
        err.type === 'request.aborted'
      ) {
        return reject(Object.assign(new Error('aborted'), { aborted: true }))
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return reject(Object.assign(new Error('too_large'), { tooLarge: true }))
      }
      reject(err)
    })
  })
}

function cleanupTempFiles(files: Express.Multer.File[]) {
  for (const f of files) {
    if (f.path) fs.unlink(f.path, () => {})
  }
}

// ── POST /api/drive/files/upload ─────────────────────────────────────────────
driveRouter.post('/files/upload', isAuth, async (req, res) => {
  try {
    await runUpload(req, res)
  } catch (err: any) {
    const partial = (req.files ?? []) as Express.Multer.File[]
    cleanupTempFiles(partial)
    if (err.aborted) return
    if (err.tooLarge) { res.status(413).json({ error: 'Archivo demasiado grande (máximo 4 GB)' }); return }
    console.log('[Drive] multer error:', err?.message ?? err)
    res.status(500).json({ error: 'Error procesando archivos' })
    return
  }

  const uploadedFiles = ((req.files ?? []) as Express.Multer.File[]).filter(f => f.fieldname === 'files')
  try {
    const auth = await getAuthedClient()
    if (!auth) { cleanupTempFiles(uploadedFiles); res.status(403).json({ error: 'Drive no conectado' }); return }

    const { folderId } = req.body
    if (!folderId) { cleanupTempFiles(uploadedFiles); res.status(400).json({ error: 'folderId requerido' }); return }
    if (uploadedFiles.length === 0) { res.status(400).json({ error: 'No se recibieron archivos' }); return }

    const drive = google.drive({ version: 'v3', auth })
    const uploaded: any[] = []

    for (const file of uploadedFiles) {
      const safeMime = file.mimetype && file.mimetype !== 'application/octet-stream'
        ? file.mimetype
        : guessMimeByExtension(file.originalname)
      const stream = fs.createReadStream(file.path)
      const response = await drive.files.create({
        requestBody: { name: file.originalname, parents: [folderId] },
        media: { mimeType: safeMime, body: stream },
        fields: 'id,name,mimeType,size,modifiedTime,webViewLink',
        supportsAllDrives: true,
      })
      uploaded.push(response.data)
    }

    cleanupTempFiles(uploadedFiles)
    // Invalidate so next load reflects the new files
    invalidateCache(folderId)
    res.json(uploaded)
  } catch (err: any) {
    console.log('[Drive] upload error:', err?.message ?? err, '| code:', err?.code, '| status:', err?.response?.status, '| data:', JSON.stringify(err?.response?.data ?? ''))
    cleanupTempFiles(uploadedFiles)
    if (!res.headersSent) res.status(500).json({ error: 'Error subiendo archivos' })
  }
})

// ── POST /api/drive/folders ───────────────────────────────────────────────────
driveRouter.post('/folders', isAuth, async (req, res) => {
  const auth = await getAuthedClient()
  if (!auth) { res.status(403).json({ error: 'Drive no conectado' }); return }
  const { name, parentId } = req.body
  if (!name || !parentId) { res.status(400).json({ error: 'name y parentId requeridos' }); return }
  try {
    const drive = google.drive({ version: 'v3', auth })
    const folder = await drive.files.create({
      requestBody: { name: String(name).trim(), mimeType: FOLDER_MIME, parents: [parentId] },
      fields: 'id,name,mimeType,modifiedTime,parents',
      supportsAllDrives: true,
    })
    invalidateCache(parentId)
    res.json(folder.data)
  } catch (err: any) {
    console.error('Drive create folder error:', err?.message ?? err)
    res.status(500).json({ error: 'No se pudo crear la carpeta' })
  }
})

// ── PATCH /api/drive/files/:id ────────────────────────────────────────────────
// Rename a file or folder
driveRouter.patch('/files/:id', isAuth, async (req, res) => {
  const auth = await getAuthedClient()
  if (!auth) { res.status(403).json({ error: 'Drive no conectado' }); return }
  const { name } = req.body
  if (!name) { res.status(400).json({ error: 'name requerido' }); return }
  try {
    const drive = google.drive({ version: 'v3', auth })
    const updated = await drive.files.update({
      fileId: req.params.id,
      requestBody: { name: String(name).trim() },
      fields: 'id,name,mimeType,size,modifiedTime,thumbnailLink,webViewLink,parents',
      supportsAllDrives: true,
    })
    // Invalidate the parent folder cache (we clear all since we don't easily know the parent)
    invalidateAll()
    res.json(updated.data)
  } catch (err: any) {
    console.error('Drive rename error:', err?.message ?? err)
    res.status(500).json({ error: 'No se pudo renombrar' })
  }
})

// ── POST /api/drive/files/:id/move ────────────────────────────────────────────
driveRouter.post('/files/:id/move', isAdminOrLead, async (req, res) => {
  const auth = await getAuthedClient()
  if (!auth) { res.status(403).json({ error: 'Drive no conectado' }); return }
  const { targetFolderId } = req.body
  if (!targetFolderId) { res.status(400).json({ error: 'targetFolderId requerido' }); return }
  try {
    const drive = google.drive({ version: 'v3', auth })
    // Get current parents
    const meta = await drive.files.get({ fileId: req.params.id, fields: 'parents', supportsAllDrives: true })
    const previousParents = (meta.data.parents ?? []).join(',')
    const moved = await drive.files.update({
      fileId: req.params.id,
      addParents: targetFolderId,
      removeParents: previousParents,
      fields: 'id,name,mimeType,size,modifiedTime,thumbnailLink,webViewLink,parents',
      supportsAllDrives: true,
    } as any)
    // Invalidate both source and target
    if (previousParents) previousParents.split(',').forEach(p => invalidateCache(p))
    invalidateCache(targetFolderId)
    res.json(moved.data)
  } catch (err: any) {
    console.error('Drive move error:', err?.message ?? err)
    res.status(500).json({ error: 'No se pudo mover el archivo' })
  }
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
  if (ids.length > 50) { res.status(400).json({ error: 'Máximo 50 archivos por descarga ZIP' }); return }

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
    // Get parents before deleting so we can invalidate
    const meta = await drive.files.get({ fileId: req.params.id, fields: 'parents', supportsAllDrives: true })
    await drive.files.delete({ fileId: req.params.id, supportsAllDrives: true })
    // Invalidate parent folders
    for (const p of meta.data.parents ?? []) invalidateCache(p)
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
    // Use in-memory name cache to avoid extra Google API calls
    const cachedName = folderNameCache.get(currentId)
    if (cachedName) {
      crumbs.unshift({ id: currentId, name: cachedName })
      // Check if this is a pinned root — stop traversal
      if (PINNED_ROOTS.some(r => r.id === currentId)) break
      // We don't know the parent without a Google call, so stop here
      // The frontend will handle root resolution
      break
    }
    try {
      const file = await drive.files.get({ fileId: currentId, fields: 'id,name,parents', supportsAllDrives: true })
      if (file.data.name) folderNameCache.set(currentId, file.data.name)
      crumbs.unshift({ id: file.data.id!, name: file.data.name! })
      currentId = file.data.parents?.[0] ?? ''
    } catch { break }
  }
  res.json(crumbs)
})
