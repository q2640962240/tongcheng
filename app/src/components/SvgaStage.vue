<template>
  <view class="svga-stage" :class="'svga-stage-l' + level">
    <view
      class="svga-holder"
      :id="'svga-holder-' + uid"
      :prop="stageProp"
      :change:prop="svgaMod.onStage"
    ></view>
  </view>
</template>

<script>
import { getCurrentBaseURL } from '@/utils/request'

// App 逻辑层没有 window，站点源从 BASE_URL 去掉 /api 推导；H5 同源，用相对路径即可
function siteBase() {
  // #ifdef H5
  return ''
  // #endif
  // #ifndef H5
  return String(getCurrentBaseURL() || '').replace(/\/api\/?$/, '') || 'https://zyb001.cn'
  // #endif
}

export default {
  name: 'SvgaStage',
  props: {
    src: { type: String, required: true },
    level: { type: Number, default: 1 },
    uid: { type: [String, Number], required: true }
  },
  emits: ['fail', 'end'],
  data() {
    return {
      stageProp: { src: '', uid: String(this.uid), base: siteBase() }
    }
  },
  mounted() {
    // 首帧先给空 src，挂载后再填真值：renderjs 的 change:prop 靠「值变化」触发，
    // 这样能确保 holder 已经在视图层 DOM 里，也避免首次同步不派发变更事件
    this.$nextTick(() => {
      this.stageProp = { ...this.stageProp, src: this.src }
    })
  },
  // 必须是 Options API 的 methods：renderjs 的 ownerInstance.callMethod 实现是
  // `this.$vm[funcName]`，而 <script setup> + defineExpose 挂到的是 exposed 代理，
  // $vm 上取不到，回调会静默丢失（H5 与 App 双端）
  methods: {
    onSvgaFail(msg) {
      this.$emit('fail', msg)
    },
    onSvgaEnd(uid) {
      this.$emit('end', uid)
    }
  }
}
</script>

<script module="svgaMod" lang="renderjs">
export default {
  methods: {
    onStage(newVal, oldVal, ownerInstance) {
      if (!newVal || !newVal.src) return
      this.run(newVal, ownerInstance)
    },

    loadScript(src) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = src
        s.onload = () => resolve()
        s.onerror = () => reject(new Error('load fail: ' + src))
        document.head.appendChild(s)
      })
    },

    ensureLib(base) {
      if (window.SVGA) return Promise.resolve(window.SVGA)
      if (this._libP) return this._libP
      // svga.min.js 的 zip 容器（SVGA 1.x）分支门控在 JSZip/JSZipUtils 两个全局上，
      // npm 构建不打包它们（官方文档要求页面另挂）。缺了 zip 素材会掉进 proto 路径
      // 报 pako "incorrect header check"，只能降级 CSS —— 缘定今生就是 zip 容器。
      // 这两个是增强项：加载失败不阻断，zlib+protobuf 素材（绝大多数）照常播。
      const b = base || ''
      this._libP = this.loadScript(b + '/static/lib/jszip.min.js').catch(() => {})
        .then(() => this.loadScript(b + '/static/lib/jszip-utils.min.js').catch(() => {}))
        .then(() => this.loadScript(b + '/static/lib/svga.min.js'))
        .then(() => (window.SVGA ? window.SVGA : Promise.reject(new Error('SVGA undefined'))))
      return this._libP
    },

    stopPrev() {
      if (this._player) {
        try { this._player.stopAnimation() } catch (_) {}
        this._player = null
      }
    },

    async run(p, ownerInstance) {
      const holder = document.getElementById('svga-holder-' + p.uid)
      if (!holder) return
      try {
        const SVGA = await this.ensureLib(p.base)
        this.stopPrev()
        holder.innerHTML = ''
        // 交给库自己建 canvas：传 DIV 时 _resize() 每帧按 holder 尺寸做 AspectFit
        // （属性尺寸=videoSize + transform 缩放居中），既铺满 holder 又是超采样，比按屏幕 dpr 更清晰。
        // 不能直接传 holder：uni-app 把 <view> 编译成 <uni-view>，过不了库里的 instanceof HTMLDivElement。
        // 更不能自己 new canvas 传进去 —— 那样库不会创建 _drawingCanvas，_resize() 只按 canvas 的
        // CSS 尺寸算 _globalTransform，却把内容画进「属性尺寸」的位图：早先这里按 dpr 放大属性尺寸，
        // iOS(dpr 截到 2) 上画面就被缩到一半并锚在左上角；桌面 dpr=1 时属性==CSS，所以从没暴露过。
        const stage = document.createElement('div')
        stage.style.position = 'absolute'
        stage.style.left = '0'
        stage.style.top = '0'
        stage.style.width = '100%'
        stage.style.height = '100%'
        holder.appendChild(stage)

        // 3s 加载超时：大素材（缘定今生 588KB）弱网下载期间特效层是黑的，
        // 超时直接走 onSvgaFail 的 CSS 降级，复用已有分支不新增。
        const vi = await Promise.race([
          new Promise((res, rej) => new SVGA.Parser().load(p.src, res, rej)),
          new Promise((_, rej) => setTimeout(() => rej(new Error('svga load timeout 3s')), 3000))
        ])
        const player = new SVGA.Player(stage)
        this._player = player
        player.setVideoItem(vi)
        player.loops = 1
        player.clearsAfterStop = true
        player.onFinished(() => {
          ownerInstance.callMethod('onSvgaEnd', p.uid)
        })
        player.startAnimation()
      } catch (e) {
        ownerInstance.callMethod('onSvgaFail', String((e && e.message) || e))
      }
    }
  }
}
</script>

<style scoped lang="scss">
.svga-stage {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.svga-holder {
  position: relative;
  overflow: hidden;
}

.svga-stage-l1 .svga-holder {
  width: 46vw;
  height: 46vw;
}

.svga-stage-l2 .svga-holder {
  width: 82vw;
  height: 82vw;
}

.svga-stage-l3 .svga-holder {
  width: 100vw;
  height: 100vh;
}
</style>
