import axios from 'axios'
import { ElLoading } from 'element-plus'
import Message from '@/plugin/Message'
import { createDesktopRequest } from './desktopRequest.mjs'
import { clearRendererSession } from './routeAccess.mjs'

const instance = axios.create({ withCredentials: true, baseURL: '/api', timeout: 10000 })
let activeRequests = 0
let loading

export default createDesktopRequest({
  post: (url, data, config) => instance.post(url, data, config),
  getToken: () => localStorage.getItem('token'),
  showLoading: () => {
    if (activeRequests++ === 0) loading = ElLoading.service({ lock: true, text: '加载中', background: 'rgba(0,0,0,0.7)' })
    return { close() { if (--activeRequests === 0) { loading?.close(); loading = null } } }
  },
  onExpired: () => { clearRendererSession(localStorage); window.ipcRenderer.send('reLogin') },
  onError: (message) => Message.error(message)
})
