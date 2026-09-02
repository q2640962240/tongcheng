import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  plugins: [uni()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['import', 'legacy-js-api']
      }
    }
  },
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // vue 由 uni-app 运行时外部提供，不可放入 manualChunks
          // chat-uikit-uniapp 缺少标准 package 入口字段，HBuilderX commonjs resolver 无法解析
          'vue-vendor': ['pinia', 'vue-i18n'],
          'tUIKit': ['@tencentcloud/chat']
        }
      }
    },
    minify: 'esbuild'
  },
  esbuild: {
    drop: ['debugger']
  }
})
