import test from 'node:test'
import assert from 'node:assert/strict'
import { createDeviceSessionManager } from '../src/renderer/src/utils/deviceSessions.mjs'

test('device list revokes only selected other session and refreshes server state', async () => {
  let sessions = [{ sessionId: 'current', current: true }, { sessionId: 'browser', current: false }]
  const state = { sessions: [], busy: false, error: '' }, calls = []
  const manager = createDeviceSessionManager(async (request) => {
    calls.push(request)
    if (request.url === '/account/revokeSession') {
      assert.equal(request.params.sessionId, 'browser')
      sessions = sessions.filter((item) => item.sessionId !== request.params.sessionId)
      return { code: 200 }
    }
    return { code: 200, data: sessions }
  }, state)
  await manager.load()
  assert.equal(state.sessions.length, 2)
  await manager.revoke(state.sessions[0])
  assert.equal(calls.length, 1)
  assert.match(state.error, /当前设备/)
  await manager.revoke(state.sessions[1])
  assert.deepEqual(state.sessions, [{ sessionId: 'current', current: true }])
  assert.equal(state.error, '')
})

test('revoke all other devices preserves current session and reports failure without clearing list', async () => {
  const current = { sessionId: 'current', current: true }
  const state = { sessions: [current], busy: false, error: '' }
  const manager = createDeviceSessionManager(async ({ url }) => url === '/account/revokeOtherSessions' ? null : { data: [current] }, state)
  assert.equal(await manager.revokeOthers(), false)
  assert.equal(state.sessions[0], current)
  assert.equal(state.busy, false)
  assert.match(state.error, /失败/)
})

test('busy device operation cannot be submitted twice', async () => {
  let release, count = 0
  const gate = new Promise((resolve) => { release = resolve })
  const state = { sessions: [], busy: false, error: '' }
  const manager = createDeviceSessionManager(async () => { count++; await gate; return { data: [] } }, state)
  const first = manager.load()
  assert.equal(await manager.load(), false)
  release()
  await first
  assert.equal(count, 1)
})
