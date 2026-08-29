const express = require('express')
const router = express.Router()
const { Feedback } = require('../models')
const { auth } = require('../middleware/auth')
const { success, paginate, fail } = require('../utils/response')

/** 问题类型（保留原有 4 类；举报子类前端展示为 refType 枚举）*/
const FEEDBACK_TYPES = [
  { key: 'bug', label: '功能异常' },
  { key: 'suggest', label: '功能建议' },
  { key: 'complaint', label: '投诉举报' },
  { key: 'other', label: '其他问题' }
]

/** 举报细分类型（前端使用；Feedback.refType 采用此枚举）*/
const REPORT_REF_TYPES = [
  { key: 'report_post', label: '举报动态', idField: 'postId' },
  { key: 'report_group', label: '举报组局', idField: 'groupId' },
  { key: 'report_user', label: '举报用户', idField: 'targetUserId' }
]

/** 获取问题类型（附带举报细分类型）*/
router.get('/types', (req, res) => {
  success(res, { feedbackTypes: FEEDBACK_TYPES, reportRefTypes: REPORT_REF_TYPES })
})

/** 提交反馈/举报
 * body: {
 *   type: bug|suggest|complaint|other,
 *   refType?: report_post|report_group|report_user,
 *   postId? / groupId? / targetUserId?,
 *   content, images?
 * }
 */
router.post('/', auth, async (req, res, next) => {
  try {
    const { type, refType, postId, groupId, targetUserId, content, images } = req.body
    if (!type || !content) return fail(res, '请填写问题类型和描述')
    // 举报校验：不同 refType 强制要求对应 ID 字段
    if (refType === 'report_post') {
      if (!postId) return fail(res, '举报动态必须填写动态 ID（postId）')
    } else if (refType === 'report_group') {
      if (!groupId) return fail(res, '举报组局必须填写组局 ID（groupId）')
    } else if (refType === 'report_user') {
      if (!targetUserId) return fail(res, '举报用户必须填写用户 ID（targetUserId）')
    }
    const fb = await Feedback.create({
      userId: req.userId,
      type,
      refType: refType || type,
      postId: postId ? Number(postId) : null,
      groupId: groupId ? Number(groupId) : null,
      targetUserId: targetUserId ? Number(targetUserId) : null,
      content,
      images
    })
    success(res, { id: fb.id }, '反馈已提交')
  } catch (err) { next(err) }
})

/** 我的反馈列表 */
router.get('/', auth, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, refType } = req.query
    const where = { userId: req.userId }
    if (refType) where.refType = refType
    const { rows, count } = await Feedback.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    paginate(res, rows, count, page, pageSize)
  } catch (err) { next(err) }
})

module.exports = router
