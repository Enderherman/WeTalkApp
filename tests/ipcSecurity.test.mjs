import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRestrictedIpc } from '../src/preload/restrictedIpc.mjs'
import { sendChannels, invokeChannels, receiveChannels } from '../src/shared/ipcChannels.mjs'
import { protectDesktopWindow, isTrustedIpcEvent, createTrustedIpcMain, isTrustedRendererUrl } from '../src/main/utils/windowSecurity.mjs'

test('preload exposes only allowlisted send/invoke/on and strips native event objects', async () => {
  const native = new EventEmitter(), calls = []
  native.send = (...args) => calls.push(args)
  native.invoke = async (...args) => { calls.push(args); return 'result' }
  const bridge = createRestrictedIpc(native)
  assert.deepEqual(Object.keys(bridge).sort(), ['invoke', 'on', 'send'])
  assert.equal(Object.isFrozen(bridge), true)
  bridge.send('loadChatSession')
  assert.equal(await bridge.invoke('loadHiddenChatSessions'), 'result')
  for (const method of ['send', 'invoke', 'on']) assert.throws(() => bridge[method]('not-registered', () => {}), /不允许/)
  assert.equal(calls.length, 2)
  const received = []
  const off = bridge.on('receiveMessage', (...args) => received.push(args))
  native.emit('receiveMessage', { sender: { secret: 'native' } }, { messageType: 2 })
  assert.deepEqual(received, [[null, { messageType: 2 }]])
  off(); off()
  native.emit('receiveMessage', {}, { messageType: 3 })
  assert.equal(received.length, 1)
})

test('unsubscribing one component preserves another component listener on the same channel', () => {
  const native = new EventEmitter(), bridge = createRestrictedIpc(native), calls = []
  const first = bridge.on('receiveMessage', () => calls.push('first'))
  const second = bridge.on('receiveMessage', () => calls.push('second'))
  first(); native.emit('receiveMessage', {})
  assert.deepEqual(calls, ['second'])
  second()
  assert.equal(native.listenerCount('receiveMessage'), 0)
})

test('navigation guards deny external pages, redirects and webviews while allowing same-origin routes', () => {
  const webContents = new EventEmitter()
  Object.assign(webContents, { id: 123, mainFrame: { routingId: 1 }, setWindowOpenHandler(handler) { this.windowOpen = handler } })
  const external = []
  protectDesktopWindow(webContents, 'http://127.0.0.1:12345/index.html', (url) => external.push(url))
  let prevented = 0
  const event = { preventDefault: () => prevented++ }
  webContents.emit('will-navigate', event, 'http://127.0.0.1:12345/index.html#/chat')
  assert.equal(prevented, 0)
  webContents.emit('will-navigate', event, 'https://evil.example/')
  webContents.emit('will-redirect', event, 'http://127.0.0.1:12345/api/file')
  webContents.emit('will-attach-webview', event)
  assert.equal(prevented, 3)
  assert.deepEqual(webContents.windowOpen({ url: 'file:///C:/test.exe' }), { action: 'deny' })
  assert.deepEqual(external, [])
  assert.deepEqual(webContents.windowOpen({ url: 'https://example.com/' }), { action: 'deny' })
  assert.deepEqual(external, ['https://example.com/'])
  const ipcEvent = { sender: webContents, senderFrame: { routingId: 1, url: 'http://127.0.0.1:12345/index.html#/chat' } }
  assert.equal(isTrustedIpcEvent(ipcEvent), true)
  assert.equal(isTrustedIpcEvent({ ...ipcEvent, senderFrame: { ...ipcEvent.senderFrame, routingId: 2 } }), false)
  assert.equal(isTrustedIpcEvent({ ...ipcEvent, senderFrame: { routingId: 1, url: 'https://evil.example' } }), false)
  webContents.emit('destroyed')
  assert.equal(isTrustedIpcEvent(ipcEvent), false)
  assert.equal(isTrustedRendererUrl('javascript:alert(1)', 'http://127.0.0.1:12345'), false)
})

test('main-process guard rejects untrusted senders before invoking registered handlers', async () => {
  const events = new Map(), handles = new Map(), called = []
  const secure = createTrustedIpcMain({ on: (channel, callback) => events.set(channel, callback), handle: (channel, callback) => handles.set(channel, callback) }, { isTrusted: (event) => event.trusted })
  secure.on('loadChatSession', (event, value) => called.push(value))
  secure.handle('loadHiddenChatSessions', (event, value) => value + 1)
  events.get('loadChatSession')({ trusted: false }, 'blocked')
  events.get('loadChatSession')({ trusted: true }, 'allowed')
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(called, ['allowed'])
  assert.throws(() => handles.get('loadHiddenChatSessions')({ trusted: false }, 1), /不允许/)
  assert.equal(handles.get('loadHiddenChatSessions')({ trusted: true }, 1), 2)
  assert.throws(() => secure.on('unknown', () => {}), /未登记/)
})

test('every current renderer IPC call is covered by the explicit channel inventory', async () => {
  const root = fileURLToPath(new URL('../src/renderer/src/', import.meta.url))
  const allowed = { send: new Set(sendChannels), invoke: new Set(invokeChannels), on: new Set(receiveChannels) }
  let checked = 0
  async function walk(folder) {
    for (const item of await readdir(folder, { withFileTypes: true })) {
      const filename = path.join(folder, item.name)
      if (item.isDirectory()) { await walk(filename); continue }
      if (!/\.(vue|js|mjs)$/.test(item.name)) continue
      const source = await readFile(filename, 'utf8')
      for (const match of source.matchAll(/(?:window\.ipcRenderer|ipc)\.(send|invoke|on)\(\s*['"]([^'"]+)['"]/g)) {
        assert.equal(allowed[match[1]].has(match[2]), true, `${filename}: ${match[1]} ${match[2]}`)
        checked++
      }
    }
  }
  await walk(root)
  assert.ok(checked > 40)
})
