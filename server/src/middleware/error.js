/** 统一错误处理 */
const errorHandler = (err, req, res, next) => {
  const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production'
  // 服务器内部类错误 → 堆栈只打日志；客户端隐藏避免泄露代码路径/ORM SQL 片段
  const status = Number(err.status) || (err.name === 'UnauthorizedError' ? 401 : err.name === 'ValidationError' ? 400 : 500)
  const privateErrorMark = String(err.message || '').startsWith('CORS_NOT_ALLOWED')
  let publicMessage = err.message || '服务器内部错误'
  if (status >= 500 && isProduction) publicMessage = '服务器内部错误'
  if (privateErrorMark) publicMessage = isProduction ? '跨域访问未授权' : publicMessage

  console.error('[Error]', req.method, req.originalUrl, '\n', err.stack || err.message)
  if (err.name === 'ValidationError') {
    return res.status(400).json({ code: 400, message: err.message })
  }
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ code: 401, message: '无权访问' })
  }
  const payload = {
    code: status,
    message: publicMessage
  }
  if (!isProduction) {
    payload._stack = (err.stack || '').split('\n').slice(0, 3).map(s => s.trim())
    payload._raw = err.message
  }
  res.status(status).json(payload)
}

/** 404 处理 */
const notFound = (req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' })
}

module.exports = { errorHandler, notFound }
