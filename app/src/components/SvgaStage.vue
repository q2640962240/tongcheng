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

    ensureLib(base) {
      if (window.SVGA) return Promise.resolve(window.SVGA)
      if (this._libP) return this._libP
      this._libP = new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = (base || '') + '/static/lib/svga.min.js'
        s.onload = () => (window.SVGA ? resolve(window.SVGA) : reject(new Error('SVGA undefined')))
        s.onerror = () => reject(new Error('svga.min.js load fail'))
        document.head.appendChild(s)
      })
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
        const w = holder.clientWidth || window.innerWidth
        const h = holder.clientHeight || window.innerHeight
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const cv = document.createElement('canvas')
        cv.width = Math.round(w * dpr)
        cv.height = Math.round(h * dpr)
        cv.style.width = w + 'px'
        cv.style.height = h + 'px'
        holder.appendChild(cv)

        const vi = await new Promise((res, rej) => new SVGA.Parser().load(p.src, res, rej))
        const player = new SVGA.Player(cv)
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
