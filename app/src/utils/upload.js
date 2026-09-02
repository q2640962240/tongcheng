/**
 * 上传封装 — 基于 uni.uploadFile
 * 自动注入 token、统一错误处理
 */
import { getToken, removeToken } from './auth'
import { getCurrentBaseURL } from './request'

/**
 * 解析上传响应
 */
const parseUploadRes = (res) => {
  return new Promise((resolve, reject) => {
    if (res.statusCode === 401) {
      removeToken()
      uni.reLaunch({ url: '/pages/login/login' })
      reject(new Error('登录已过期'))
      return
    }
    let data
    try {
      data = JSON.parse(res.data)
    } catch (e) {
      reject(new Error('上传响应解析失败'))
      return
    }
    if (res.statusCode >= 400 || data.code !== 0) {
      const msg = (data && data.message) || `上传失败 (${res.statusCode})`
      uni.showToast({ title: msg, icon: 'none' })
      reject(new Error(msg))
      return
    }
    resolve(data.data)
  })
}

/**
 * 上传单文件
 * @param {string} filePath 本地临时文件路径（来自 chooseImage / chooseVideo / chooseMessageFile）
 * @param {string} name 后端接收字段名，默认 'file'
 * @returns {Promise<{url:string, filename:string, originalName:string, size:number}>}
 */
export const uploadFile = (filePath, name = 'file') => {
  return new Promise((resolve, reject) => {
    const token = getToken()
    uni.uploadFile({
      url: getCurrentBaseURL() + '/upload',
      filePath,
      name,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => parseUploadRes(res).then(resolve).catch(reject),
      fail: (err) => {
        uni.showToast({ title: '上传失败', icon: 'none' })
        reject(err)
      }
    })
  })
}

/**
 * 上传单文件到指定端点（用于头像、认证照片等专用接口）
 * @param {string} path 相对路径（如 /user/avatar）
 * @param {string} filePath 本地临时文件路径
 * @param {string} name 后端接收字段名，默认 'file'
 * @param {object} formData 额外表单字段
 */
export const uploadFileTo = (path, filePath, name = 'file', formData = {}) => {
  return new Promise((resolve, reject) => {
    const token = getToken()
    uni.uploadFile({
      url: getCurrentBaseURL() + path,
      filePath,
      name,
      formData,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => parseUploadRes(res).then(resolve).catch(reject),
      fail: (err) => {
        uni.showToast({ title: '上传失败', icon: 'none' })
        reject(err)
      }
    })
  })
}

/**
 * 上传多文件（并发）
 * @param {string[]} filePaths
 * @returns {Promise<Array>} 上传结果数组
 */
export const uploadFiles = async (filePaths) => {
  return Promise.all(filePaths.map((p) => uploadFile(p)))
}

export default uploadFile
