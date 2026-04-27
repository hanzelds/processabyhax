import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../lib/prisma'
import { isAuth } from '../middleware/auth'
import { logProjectHistory } from '../lib/projectHistory'

export const projectFilesRouter = Router({ mergeParams: true })

const UPLOAD_BASE = '/mnt/volume-us-dodso/var/www/erp-hax/storage/processa/uploads/projects'

// ── Allowed MIME types ────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/tiff',
  'image/heic',
  'image/heif',
  // Video
  'video/mp4',
  'video/quicktime',   // .mov
  'video/x-msvideo',  // .avi
  'video/x-matroska', // .mkv
  'video/webm',
  'video/mpeg',
  // Audio
  'audio/mpeg',        // .mp3
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/ogg',
  // Design / Creative
  'application/postscript',              // .ai
  'image/vnd.adobe.photoshop',           // .psd
  'application/x-indesign',             // .indd
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
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
  // No fileSize limit — disk space is the only constraint
})

// ── GET /projects/:id/files ───────────────────────────────────────────────────
projectFilesRouter.get('/', isAuth, async (req, res) => {
  const files = await prisma.projectFile.findMany({
    where: { projectId: req.params.id },
    include: { uploader: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(files)
})

// ── POST /projects/:id/files (single) ────────────────────────────────────────
projectFilesRouter.post('/', isAuth, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message })
      return
    }
    next()
  })
}, async (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'Archivo requerido' }); return }

  const fileType = (req.body.fileType || 'other') as 'brief' | 'reference' | 'contract' | 'other'
  const file = await prisma.projectFile.create({
    data: {
      projectId:    req.params.id,
      uploadedById: req.user!.userId,
      originalName: req.file.originalname,
      storedName:   req.file.filename,
      filePath:     req.file.path,
      fileType,
      mimeType:     req.file.mimetype,
      sizeBytes:    req.file.size,
    },
    include: { uploader: { select: { id: true, name: true } } },
  })

  await logProjectHistory({
    projectId: req.params.id,
    actorId: req.user!.userId,
    eventType: 'file_uploaded',
    description: `Archivo "${req.file.originalname}" subido`,
    meta: { fileId: file.id, originalName: req.file.originalname, fileType },
  })

  res.status(201).json(file)
})

// ── GET /projects/:id/files/:fileId/download ─────────────────────────────────
projectFilesRouter.get('/:fileId/download', isAuth, async (req, res) => {
  const file = await prisma.projectFile.findFirst({
    where: { id: req.params.fileId, projectId: req.params.id },
  })
  if (!file) { res.status(404).json({ error: 'Archivo no encontrado' }); return }
  if (!fs.existsSync(file.filePath)) { res.status(404).json({ error: 'Archivo no disponible en disco' }); return }

  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`)
  res.setHeader('Content-Type', file.mimeType)
  res.setHeader('Content-Length', file.sizeBytes)
  res.sendFile(path.resolve(file.filePath))
})

// ── DELETE /projects/:id/files/:fileId ───────────────────────────────────────
projectFilesRouter.delete('/:fileId', isAuth, async (req, res) => {
  const file = await prisma.projectFile.findFirst({
    where: { id: req.params.fileId, projectId: req.params.id },
  })
  if (!file) { res.status(404).json({ error: 'Archivo no encontrado' }); return }

  const canDelete = req.user!.role === 'ADMIN' || req.user!.role === 'LEAD' || file.uploadedById === req.user!.userId
  if (!canDelete) { res.status(403).json({ error: 'Sin permiso para eliminar este archivo' }); return }

  await prisma.projectFile.delete({ where: { id: file.id } })
  try { fs.unlinkSync(file.filePath) } catch { /* already gone */ }

  await logProjectHistory({
    projectId: req.params.id,
    actorId: req.user!.userId,
    eventType: 'file_deleted',
    description: `Archivo "${file.originalName}" eliminado`,
    meta: { fileId: file.id, originalName: file.originalName },
  })

  res.json({ ok: true })
})
