/** 统一响应封装 */
const success = (res, data = null, message = '成功', meta) => {
  const payload = { code: 0, message, data }
  if (meta && typeof meta === 'object') payload.meta = meta
  res.json(payload)
}

const paginate = (res, list, total, page, pageSize, extras, meta) => {
  const data = { list, total, page: Number(page), pageSize: Number(pageSize) }
  if (extras && typeof extras === 'object') Object.assign(data, extras)
  const payload = { code: 0, message: '成功', data }
  if (meta && typeof meta === 'object') payload.meta = meta
  res.json(payload)
}

const fail = (res, message = '失败', code = 400) => {
  res.status(code).json({ code, message })
}

module.exports = { success, paginate, fail }
