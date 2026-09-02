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
    // manualChunks 会触发代码分割，与 HBuilderX App 打包的 IIFE 格式不兼容
    // H5 部署由 Docker 构建，无需额外分包配置
    minify: 'esbuild'
  },
  esbuild: {
    drop: ['debugger']
  }
})
