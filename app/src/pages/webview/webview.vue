<template>
  <web-view :src="url"></web-view>
</template>
<script>
export default {
  data() {
    return {
      url: ''
    }
  },
  onLoad(options) {
    if (options.url) {
      const url = decodeURIComponent(options.url)
      try {
        const parsed = new URL(url)
        // 仅允许 http/https 协议
        if (!/^https?:$/i.test(parsed.protocol)) {
          uni.showToast({ title: '不支持的链接协议', icon: 'none' })
          return
        }
        // 项目域名及其子域名免提示，其他域名给出安全提示
        const trustedHosts = ['zyb001.cn', 'www.zyb001.cn']
        const isTrusted = trustedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))
        if (!isTrusted) {
          uni.showToast({ title: '正在打开外部链接', icon: 'none' })
        }
        this.url = url
      } catch (_) {
        uni.showToast({ title: '无效的链接', icon: 'none' })
      }
    }
  }
}
</script>
