const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const { auth } = require('../middleware/auth')
const { success, fail } = require('../utils/response')
const oss = require('../utils/oss')

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const name = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`
    cb(null, name)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /image\/|audio\//
    if (allowed.test(file.mimetype)) cb(null, true)
    else cb(new Error('只允许上传图片或音频'))
  }
})

/** 上传单文件 */
router.post('/', auth, upload.single('file'), async (req, res, next) => {
  if (!req.file) return fail(res, '请选择文件')
  try {
    const result = await oss.upload(req.file.path, req.file.filename, req.file.mimetype)
    if (!result.success) return fail(res, result.message || '上传失败')
    success(res, {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      url: result.url,
      provider: result.provider
    }, '上传成功')
  } catch (e) {
    // OSS 上传失败时回退本地 URL
    success(res, {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`,
      provider: 'local-fallback'
    }, '上传成功（本地回退）')
  }
})

/** 上传多文件 */
router.post('/multiple', auth, upload.array('files', 9), async (req, res, next) => {
  if (!req.files || req.files.length === 0) return fail(res, '请选择文件')
  const files = []
  for (const f of req.files) {
    try {
      const result = await oss.upload(f.path, f.filename, f.mimetype)
      files.push({
        filename: f.filename,
        originalName: f.originalname,
        size: f.size,
        url: result.success ? result.url : `/uploads/${f.filename}`,
        provider: result.provider
      })
    } catch (e) {
      files.push({
        filename: f.filename,
        originalName: f.originalname,
        size: f.size,
        url: `/uploads/${f.filename}`,
        provider: 'local-fallback'
      })
    }
  }
  success(res, files, '上传成功')
})

module.exports = router
