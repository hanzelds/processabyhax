import express, { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../lib/prisma'
import { isAuth, isAdminOrLead } from '../middleware/auth'

export const briefFilesRouter = Router({ mergeParams: true })

const UPLOAD_BASE = '/mnt/volume-us-dodso/var/www/erp-hax/storage/processa/uploads/briefs'
export const BRIEF_FILES_BASE = UPLOAD_BASE

const ALLOWED_MIME_TYPES = new Set([
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  // Images
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  'image/heic', 'image/heif', 'image/tiff',
  // Video
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg',
  // Audio
  'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg',
  // Design
  'application/postscript',
  'image/vnd.adobe.photoshop',
  // Archives
  'application/zip', 'application/x-zip-compressed',
])

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = `${UPLOAD_BASE}/${req.params.id}`
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  },
})

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`))
    }
  },
})

// ── GET /briefs/:id/files ────────────────────────────────────────────────────
briefFilesRouter.get('/', isAuth, async (req, res) => {
  const files = await prisma.briefFile.findMany({
    where: { briefId: req.params.id },
    include: { uploader: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  res.json(files)
})

// ── POST /briefs/:id/files ───────────────────────────────────────────────────
briefFilesRouter.post('/', isAdminOrLead, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) { res.status(400).json({ error: err.message }); return }
    next()
  })
}, async (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'Archivo requerido' }); return }

  const file = await prisma.briefFile.create({
    data: {
      briefId:      req.params.id,
      uploadedById: req.user!.userId,
      originalName: req.file.originalname,
      storedName:   req.file.filename,
      filePath:     req.file.path,
      mimeType:     req.file.mimetype,
      sizeBytes:    req.file.size,
      label:        req.body.label || null,
    },
    include: { uploader: { select: { id: true, name: true } } },
  })

  // Log in brief history
  await prisma.briefHistory.create({
    data: {
      briefId:     req.params.id,
      actorId:     req.user!.userId,
      eventType:   'file_uploaded',
      description: `Archivo "${req.file.originalname}" subido`,
      meta:        { fileId: file.id, originalName: req.file.originalname },
    },
  })

  res.status(201).json(file)
})

// ── GET /briefs/:id/files/:fileId/view — inline (for portal + preview) ───────
briefFilesRouter.get('/:fileId/view', async (req: express.Request<{ id: string; fileId: string }>, res) => {
  // No auth required — portal needs to view files without token
  const file = await prisma.briefFile.findFirst({
    where: { id: req.params.fileId, briefId: req.params.id },
  })
  if (!file) { res.status(404).json({ error: 'Archivo no encontrado' }); return }
  if (!fs.existsSync(file.filePath)) { res.status(404).json({ error: 'Archivo no disponible' }); return }

  res.setHeader('Content-Type', file.mimeType)
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`)
  res.setHeader('Content-Length', file.sizeBytes)
  res.sendFile(path.resolve(file.filePath))
})

// ── GET /briefs/:id/files/:fileId/download ───────────────────────────────────
briefFilesRouter.get('/:fileId/download', isAuth, async (req, res) => {
  const file = await prisma.briefFile.findFirst({
    where: { id: req.params.fileId, briefId: req.params.id },
  })
  if (!file) { res.status(404).json({ error: 'Archivo no encontrado' }); return }
  if (!fs.existsSync(file.filePath)) { res.status(404).json({ error: 'Archivo no disponible' }); return }

  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`)
  res.setHeader('Content-Type', file.mimeType)
  res.setHeader('Content-Length', file.sizeBytes)
  res.sendFile(path.resolve(file.filePath))
})

// ── DELETE /briefs/:id/files/:fileId ────────────────────────────────────────
briefFilesRouter.delete('/:fileId', isAdminOrLead, async (req, res) => {
  const file = await prisma.briefFile.findFirst({
    where: { id: req.params.fileId, briefId: req.params.id },
  })
  if (!file) { res.status(404).json({ error: 'Archivo no encontrado' }); return }

  await prisma.briefFile.delete({ where: { id: file.id } })
  try { fs.unlinkSync(file.filePath) } catch { /* already gone */ }

  await prisma.briefHistory.create({
    data: {
      briefId:     req.params.id,
      actorId:     req.user!.userId,
      eventType:   'file_deleted',
      description: `Archivo "${file.originalName}" eliminado`,
    },
  })

  res.json({ ok: true })
})
