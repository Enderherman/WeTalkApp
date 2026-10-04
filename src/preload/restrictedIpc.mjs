import { sendChannels, invokeChannels, receiveChannels } from '../shared/ipcChannels.mjs'

export function createRestrictedIpc(ipcRenderer) {
  const sent = new Set(sendChannels), invoked = new Set(invokeChannels), received = new Set(receiveChannels)
  const check = (allowed, channel) => { if (!allowed.has(channel)) throw new Error(`不允许的 IPC 通道：${String(channel)}`) }
  function on(channel, listener) {
    check(received, channel)
    if (typeof listener !== 'function') throw new TypeError('IPC 监听器必须是函数')
    const wrapper = (_event, ...args) => listener(null, ...args)
    ipcRenderer.on(channel, wrapper)
    let active = true
    return () => {
      if (!active) return
      active = false
      ipcRenderer.removeListener(channel, wrapper)
    }
  }
  return Object.freeze({
    send(channel, ...args) { check(sent, channel); ipcRenderer.send(channel, ...args) },
    invoke(channel, ...args) { check(invoked, channel); return ipcRenderer.invoke(channel, ...args) },
    on
  })
}
