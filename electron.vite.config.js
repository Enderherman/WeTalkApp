import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

const apiProxyTarget = (process.env.RENDERER_VITE_WETALK_SERVER_ORIGIN || 'http://127.0.0.1:5050').replace(/\/+$/, '')

export default defineConfig({
  main: {
    envPrefix: ['MAIN_VITE_', 'RENDERER_VITE_'],
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [vue()],
    server: {
      hmr: true,
      port: 5000,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          pathRewrite: {
            '^/api': '/api'
          }
        }
      }
    }
  }
})
