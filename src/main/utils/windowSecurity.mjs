import { sendChannels, invokeChannels } from '../../shared/ipcChannels.mjs'
import { externalHttpUrl } from './updateDownload.mjs'

const trustedRenderers = new Map()
export function isTrustedRendererUrl(value, entryUrl) {
  try {
    const url = new URL(value), entry = new URL(entryUrl)
    return ['http:', 'https:'].includes(url.protocol) && url.origin === entry.origin && ['/', '/index.html'].includes(url.pathname)
  } catch { return false }
}

export function protectDesktopWindow(webContents, entryUrl, openExternal) {
  trustedRenderers.set(webContents.id, entryUrl)
  const preventUntrusted = (event, url) => { if (!isTrustedRendererUrl(url, entryUrl)) event.preventDefault() }
  webContents.on('will-navigate', preventUntrusted)
  webContents.on('will-redirect', preventUntrusted)
  webContents.on('will-attach-webview', (event) => event.preventDefault())
  webContents.setWindowOpenHandler(({ url }) => {
    const safeUrl = externalHttpUrl(url)
    if (safeUrl) void openExternal(safeUrl)
    return { action: 'deny' }
  })
  webContents.once('destroyed', () => trustedRenderers.delete(webContents.id))
}

export function isTrustedIpcEvent(event) {
  const entryUrl = trustedRenderers.get(event.sender?.id)
  const frame = event.senderFrame
  return Boolean(entryUrl && frame && frame.routingId === event.sender.mainFrame?.routingId && isTrustedRendererUrl(frame.url, entryUrl))
}

export function createTrustedIpcMain(nativeIpc, { isTrusted = isTrustedIpcEvent, onError = (error) => console.error('IPC 操作失败:', error.message) } = {}) {
  const sent = new Set(sendChannels), invoked = new Set(invokeChannels)
  return {
    on(channel, listener) {
      if (!sent.has(channel)) throw new Error(`未登记的 IPC 通道：${channel}`)
      nativeIpc.on(channel, (event, ...args) => {
        if (!isTrusted(event)) return
        Promise.resolve().then(() => listener(event, ...args)).catch(onError)
      })
    },
    handle(channel, listener) {
      if (!invoked.has(channel)) throw new Error(`未登记的 IPC 通道：${channel}`)
      nativeIpc.handle(channel, (event, ...args) => {
        if (!isTrusted(event)) throw new Error('不允许的 IPC 来源')
        return listener(event, ...args)
      })
    }
  }
}
