import test from 'node:test'
import assert from 'node:assert/strict'
import { desktopRouteAccess, clearRendererSession } from '../src/renderer/src/utils/routeAccess.mjs'
import { clearDesktopSession } from '../src/main/utils/sessionLifecycle.mjs'
import { createDesktopRequest } from '../src/renderer/src/utils/desktopRequest.mjs'
import { createServer } from 'node:http'
import axios from 'axios'

test('desktop routes require login and an administrator role for management pages', () => {
  assert.equal(desktopRouteAccess('/chat', null, null), '/login')
  assert.equal(desktopRouteAccess('/admin/userList', 'token', { admin: false }), '/chat')
  assert.equal(desktopRouteAccess('/admin/userList', 'token', { admin: true }), true)
  assert.equal(desktopRouteAccess('/login', null, null), true)
})

test('logout clears only authentication storage, resets stores and closes child windows', async () => {
  const storage = new Map([['token', 'secret'], ['userInfo', 'profile'], ['preference', 'keep']])
  let resets = 0
  clearRendererSession({ removeItem: (key) => storage.delete(key) }, [{ $reset: () => resets++ }])
  assert.equal(storage.has('token'), false)
  assert.equal(storage.get('preference'), 'keep')
  assert.equal(resets, 1)
  const calls = []
  const main = { isDestroyed: () => false, webContents: { send: (event) => calls.push(event) } }
  const child = { isDestroyed: () => false, close: () => calls.push('child-closed') }
  await clearDesktopSession({ store: { deleteUserData: (key) => calls.push(key), initUserId: (id) => calls.push(id) }, closeSocket: () => calls.push('socket-closed'), closeMedia: async () => calls.push('media-closed'), windows: [main, child], mainWindow: main, resetWindow: () => calls.push('reset') })
  assert.deepEqual(calls, ['socket-closed', 'token', 'currentSessionId', 'admin', null, 'child-closed', 'media-closed', 'reset', 'reLogin'])
})

test('network and business errors always close loading and respect silent requests', async () => {
  let closed = 0
  const errors = []
  const request = createDesktopRequest({ post: async () => { throw new Error('offline') }, getToken: () => 'token', showLoading: () => ({ close: () => closed++ }), onExpired: () => {}, onError: (error) => errors.push(error) })
  assert.equal(await request({ url: '/test' }), null)
  assert.equal(await request({ url: '/test', showError: false }), null)
  assert.equal(closed, 2)
  assert.equal(errors.length, 1)
})

test('stale expired responses cannot log out a newer session and JSON requests use real JSON', async () => {
  let token = 'old', expired = 0
  const request = createDesktopRequest({ post: async (url, body, config) => { assert.deepEqual(body, { value: 1 }); assert.equal(config.headers['Content-Type'], 'application/json'); token = 'new'; return { data: { code: 901 } } }, getToken: () => token, showLoading: () => ({ close() {} }), onExpired: () => expired++, onError: () => {} })
  await request({ url: '/test', params: { value: 1 }, dataType: 'json' })
  assert.equal(expired, 0)
})

test('current expired session is cleared and stale success is not exposed to a new account', async () => {
  let token = 'old', expired = 0
  const options = { getToken: () => token, showLoading: () => ({ close() {} }), onExpired: () => expired++, onError() {} }
  const expiredRequest = createDesktopRequest({ ...options, post: async () => ({ data: { code: 901 } }) })
  await expiredRequest({ url: '/test' })
  assert.equal(expired, 1)
  const staleRequest = createDesktopRequest({ ...options, post: async () => { token = 'new'; return { data: { code: 200, data: 'old private profile' } } } })
  assert.equal(await staleRequest({ url: '/test' }), null)
})

test('request transport sends real multipart files with boundary and authentication', async () => {
  let received = ''
  const server = createServer((req, res) => {
    assert.match(req.headers['content-type'], /^multipart\/form-data; boundary=/)
    assert.equal(req.headers.token, 'token')
    req.on('data', (chunk) => { received += chunk })
    req.on('end', () => { res.setHeader('content-type', 'application/json'); res.end('{"code":200,"data":"ok"}') })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const request = createDesktopRequest({ post: (url, data, config) => axios.post(url, data, config), getToken: () => 'token', showLoading: () => ({ close() {} }), onExpired() {}, onError() {} })
    const result = await request({ url: `http://127.0.0.1:${server.address().port}`, params: { nickName: 'name', avatarFile: new Blob(['image-bytes'], { type: 'image/png' }) } })
    assert.equal(result.data, 'ok')
    assert.match(received, /image-bytes/)
    assert.match(received, /name="avatarFile"/)
  } finally { await new Promise((resolve) => server.close(resolve)) }
})

test('editing a profile without selecting a file omits existing avatar IDs', async () => {
  const request = createDesktopRequest({ post: async (url, body) => { assert.equal(body.get('avatarFile'), null); assert.equal(body.get('robotFile'), null); assert.equal(body.get('nickName'), 'new name'); return { data: { code: 200 } } }, getToken: () => 'token', showLoading: () => ({ close() {} }), onExpired() {}, onError() {} })
  assert.equal((await request({ url: '/account/saveUserInfo', params: { avatarFile: 'Uself', robotFile: 'Urobot', nickName: 'new name' } })).code, 200)
})
