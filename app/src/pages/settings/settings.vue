<template>
  <view class="page">
    <view class="list">
      <view class="item" @tap="onRealPerson">
        <text class="item-label">真人认证</text>
        <view class="item-right">
          <text class="item-value" :class="certStatus.realPerson">{{ realPersonText }}</text>
          <text class="arrow">›</text>
        </view>
      </view>
      <view class="item" @tap="onIdentity">
        <text class="item-label">身份认证</text>
        <view class="item-right">
          <text class="item-value" :class="certStatus.identity">{{ identityText }}</text>
          <text class="arrow">›</text>
        </view>
      </view>
      <view class="item" @tap="onPhone">
        <text class="item-label">手机号设置</text>
        <view class="item-right">
          <text class="item-value">{{ phoneMasked }}</text>
          <text class="arrow">›</text>
        </view>
      </view>
      <view class="item">
        <text class="item-label">短信免打扰</text>
        <view class="item-right">
          <switch :checked="smsDnd" color="#D4AF37" @change="onToggleDnd" />
        </view>
      </view>
      <view class="item">
        <text class="item-label">动态消息通知</text>
        <view class="item-right">
          <switch :checked="postNotify" color="#D4AF37" @change="e => onToggleNotify('post', e.detail.value)" />
        </view>
      </view>
      <view class="item">
        <text class="item-label">组局消息通知</text>
        <view class="item-right">
          <switch :checked="groupNotify" color="#D4AF37" @change="e => onToggleNotify('group', e.detail.value)" />
        </view>
      </view>
      <view class="item" @tap="onServerUrl">
        <text class="item-label">服务器地址（调试）</text>
        <view class="item-right">
          <text class="item-value mono" :style="{'max-width':'420rpx','word-break':'break-all','text-align':'right'}">{{ currentBaseURLShort }}</text>
          <text class="arrow">›</text>
        </view>
      </view>
      <view class="item" @tap="onAbout">
        <text class="item-label">关于我们</text>
        <view class="item-right">
          <text class="arrow">›</text>
        </view>
      </view>
      <view class="item" @tap="onCancel">
        <text class="item-label danger">账号注销</text>
        <view class="item-right">
          <text class="arrow">›</text>
        </view>
      </view>
    </view>

    <view class="logout-btn" @tap="onLogout">退出登录</view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '../../store/user'
import { userApi, settingsApi, authApi } from '../../api'
import { post, getCurrentBaseURL, setRuntimeBaseURL, resetRuntimeBaseURL } from '../../utils/request'

const userStore = useUserStore()
const phone = ref('')
const smsDnd = ref(false)
const postNotify = ref(true)
const groupNotify = ref(true)
const certStatus = ref({ realPerson: 'none', identity: 'none' })

// ---- 服务器地址（真机调试 / 本机WiFi 场景热切换，不用重新打包）----
const currentBaseURL = ref(getCurrentBaseURL())
const currentBaseURLShort = computed(() => {
  const u = currentBaseURL.value || ''
  if (u.length <= 44) return u
  return u.slice(0, 18) + '…' + u.slice(-24)
})
const refreshBaseURL = () => { currentBaseURL.value = getCurrentBaseURL() }
const onServerUrl = () => {
  const def = getCurrentBaseURL()
  uni.showModal({
    title: '设置服务器地址',
    editable: true,
    placeholderText: '例如 http://电脑IP:3000/api',
    content: def,
    confirmText: '保存',
    cancelText: '重置默认',
    success: (res) => {
      if (res.confirm) {
        const v = String(res.content || '').trim()
        if (!v) return uni.showToast({ title: '地址不能为空', icon: 'none' })
        if (!/^https?:\/\//i.test(v)) return uni.showToast({ title: '必须以 http:// 或 https:// 开头', icon: 'none' })
        setRuntimeBaseURL(v)
        refreshBaseURL()
        uni.showToast({ title: '已保存，立即生效', icon: 'success' })
        // 提示用户重启数据加载
        setTimeout(() => uni.showModal({
          title: '服务器地址已切换',
          content: `当前地址：${getCurrentBaseURL()}\n请下拉刷新首页或重启 App 以加载最新数据。`,
          showCancel: false
        }), 500)
      } else if (res.cancel === true) {
        resetRuntimeBaseURL()
        refreshBaseURL()
        uni.showToast({ title: '已重置为默认地址', icon: 'none' })
      }
    }
  })
}

const phoneMasked = computed(() => {
  const p = phone.value
  if (!p || p.length < 7) return p || '未绑定'
  return p.slice(0, 3) + '****' + p.slice(-4)
})

const realPersonText = computed(() => {
  const m = { none: '未认证', pending: '审核中', passed: '已通过', rejected: '未通过' }
  return m[certStatus.value.realPerson] || '未认证'
})

const identityText = computed(() => {
  const m = { none: '未认证', pending: '审核中', passed: '已通过', rejected: '未通过' }
  return m[certStatus.value.identity] || '未认证'
})

const certClassMap = { passed: 'passed', pending: 'pending', rejected: 'pending', none: 'pending' }

const loadData = async () => {
  try {
    const [p, certs, s] = await Promise.all([
      userApi.profile(),
      userApi.certifications(),
      settingsApi.get()
    ])
    phone.value = p.data.phone || ''
    certStatus.value = certs.data || { realPerson: 'none', identity: 'none' }
    smsDnd.value = !!(s.data && s.data.smsDnd)
    const meta = (s.data && s.data.meta && typeof s.data.meta === 'object') ? s.data.meta : {};
    const notify = meta.notification || meta.notify || {};
    postNotify.value = notify.post !== false;
    groupNotify.value = notify.group !== false;
  } catch (e) {}
}

const onRealPerson = () => {
  if (certStatus.value.realPerson === 'passed') {
    uni.showToast({ title: '真人认证已通过', icon: 'none' })
  } else {
    uni.navigateTo({ url: '/pages/elite/elite' })
  }
}
const onIdentity = () => {
  uni.showToast({
    title: '身份认证需在精英认证流程中完成',
    icon: 'none',
    duration: 2500
  })
  setTimeout(() => uni.navigateTo({ url: '/pages/elite/elite' }), 1500)
}
const onPhone = () => {
  uni.showModal({
    title: '换绑手机号',
    editable: true,
    placeholderText: '请输入新手机号',
    confirmText: '发送验证码',
    success: (res) => {
      if (res.confirm && /^1\d{10}$/.test(res.content)) {
        const newPhone = res.content
        authApi.sendSms(newPhone).then(() => {
          uni.showModal({
            title: '输入验证码',
            editable: true,
            placeholderText: '6位验证码',
            success: (r2) => {
              if (r2.confirm) {
                settingsApi.bindPhone(newPhone, r2.content).then(() => {
                  phone.value = newPhone
                  uni.showToast({ title: '手机号更新成功', icon: 'success' })
                }).catch(() => uni.showToast({ title: '更新失败', icon: 'none' }))
              }
            }
          })
        }).catch(() => uni.showToast({ title: '验证码发送失败', icon: 'none' }))
      } else if (res.confirm) {
        uni.showToast({ title: '手机号格式不正确', icon: 'none' })
      }
    }
  })
}
const onToggleDnd = async (e) => {
  const enabled = e.detail.value
  smsDnd.value = enabled
  try {
    await settingsApi.toggleSmsDnd(enabled)
    uni.showToast({ title: enabled ? '已开启免打扰' : '已关闭免打扰', icon: 'none' })
  } catch (err) {
    smsDnd.value = !enabled
    uni.showToast({ title: '设置失败', icon: 'none' })
  }
}
const onToggleNotify = async (type, enabled) => {
  if (type === 'post') postNotify.value = enabled;
  if (type === 'group') groupNotify.value = enabled;
  try {
    // 复用 get 的整体结构，调用通用 meta patch（若后端未实现，则本地保存）
    await post('/settings/notify', { type, enabled });
  } catch (err) {
    try {
      const key = 'by_notify_' + (userStore.userId || 'anon');
      const prev = JSON.parse(uni.getStorageSync(key) || '{}');
      prev[type] = enabled;
      uni.setStorageSync(key, JSON.stringify(prev));
    } catch (e) {}
  }
  const labelMap = { post: '动态通知', group: '组局通知' };
  uni.showToast({ title: `${labelMap[type] || ''}已${enabled ? '开启' : '关闭'}`, icon: 'none' });
}
const onAbout = () => uni.showModal({
  title: '关于我们',
  content: '白夜 v1.0.0\n白夜 + 线上付费陪玩陪聊平台',
  showCancel: false
})
const onCancel = () => {
  uni.showModal({
    title: '账号注销',
    content: '注销后账号将进入 30 天冷静期，期间无法登录。确认注销？',
    confirmText: '确认注销',
    confirmColor: '#EF4444',
    success: (res) => {
      if (res.confirm) {
        settingsApi.cancelAccount().then(() => {
          uni.showToast({ title: '注销申请已提交', icon: 'success' })
          setTimeout(() => userStore.logout(), 1500)
        }).catch((err) => {
          const msg = (err && err.message) || '注销失败'
          uni.showToast({ title: msg, icon: 'none', duration: 3000 })
        })
      }
    }
  })
}

const onLogout = () => {
  uni.showModal({
    title: '退出登录',
    content: '确认退出当前账号？',
    confirmText: '确认退出',
    cancelText: '取消',
    confirmColor: '#EF4444',
    success: (res) => { if (res.confirm) userStore.logout() }
  })
}

onShow(loadData)
</script>

<style lang="scss" scoped>
/* 依赖 uni.scss 全局注入的 $by-* token；无需再次 @use */
.page { min-height: 100vh; background: $by-bg; padding: 32rpx; }
.list {
  background: $by-card-bg; border-radius: 32rpx; overflow: hidden; margin-bottom: 32rpx;
  box-shadow: 0 8rpx 24rpx color.adjust($by-black, $alpha: 0.06);
}
.item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 32rpx; border-bottom: 2rpx solid $by-divider;
  &:last-child { border-bottom: none; }
  &:active { background: $by-soft-card; }
}
.item-label { font-size: 30rpx; color: $by-text-1; }
.item-label.danger { color: $by-error; }
.item-right { display: flex; align-items: center; gap: 12rpx; }
.item-value { font-size: 28rpx; color: $by-text-2; }
.item-value.passed { color: $by-success; }
.item-value.pending { color: $by-warn; }
.item-value.mono { font-family: Menlo, Consolas, monospace; color: $by-text-3; }
.arrow { font-size: 40rpx; color: $by-text-muted; }
.logout-btn {
  height: 96rpx; background: $by-card-bg; color: $by-error;
  border-radius: 9999rpx; display: flex; align-items: center; justify-content: center;
  font-size: 30rpx; font-weight: 600;
  border: 2rpx solid color.adjust($by-error, $alpha: 0.2);
}
</style>
