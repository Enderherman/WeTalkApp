import test from 'node:test'
import assert from 'node:assert/strict'
import { createRealtimeClient } from '../src/main/utils/realtimeClient.mjs'

function fixture(onMessage = async () => {}) {
  let id = 0
  const intervals = new Map(), timeouts = new Map(), sockets = [], errors = []
  const timers = {
    setInterval(fn) { intervals.set(++id, fn); return id },
    clearInterval(key) { intervals.delete(key) },
    setTimeout(fn) { timeouts.set(++id, fn); return id },
    clearTimeout(key) { timeouts.delete(key) }
  }
  const client = createRealtimeClient({ timers, onMessage, onError: (e) => errors.push(e), createSocket() {
    const socket = { readyState: 1, sent: [], close() { this.onclose?.() }, send(data) { this.sent.push(data) } }
    sockets.push(socket)
    return socket
  } })
  return { client, sockets, intervals, timeouts, errors, tick() { const pending = [...timeouts.values()]; timeouts.clear(); pending.forEach((fn) => fn()) } }
}

test('reconnect owns exactly one heartbeat and ignores duplicate close/error', () => {
  const f = fixture()
  f.client.start('ws://one')
  const first = f.sockets[0]
  first.onopen()
  assert.equal(f.intervals.size, 1)
  first.onerror(new Error('offline'))
  first.onclose()
  assert.equal(f.intervals.size, 0)
  assert.equal(f.timeouts.size, 1)
  f.tick()
  f.sockets[1].onopen()
  assert.equal(f.intervals.size, 1)
  first.onopen()
  assert.equal(f.intervals.size, 1)
  f.client.stop()
  f.client.stop()
  assert.equal(f.intervals.size, 0)
  assert.equal(f.timeouts.size, 0)
})

test('logout cancels a scheduled reconnect and new account rejects stale frames', async () => {
  const received = []
  const f = fixture(async (data) => received.push(data))
  f.client.start('ws://one')
  const old = f.sockets[0]
  old.onclose()
  f.client.stop()
  f.tick()
  assert.equal(f.sockets.length, 1)
  f.client.start('ws://two')
  old.onmessage({ data: '{"account":"old"}' })
  f.sockets[1].onmessage({ data: '{"account":"new"}' })
  await f.client.settled()
  assert.deepEqual(received, [{ account: 'new' }])
})

test('frames persist in arrival order even when the first write is delayed', async () => {
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const received = []
  const f = fixture(async ({ id }) => { if (id === 14) await gate; received.push(id) })
  f.client.start('ws://one')
  for (const id of [14, 15, 16]) f.sockets[0].onmessage({ data: JSON.stringify({ id }) })
  await Promise.resolve()
  assert.deepEqual(received, [])
  release()
  await f.client.settled()
  assert.deepEqual(received, [14, 15, 16])
})

test('malformed frame does not poison the subsequent queue', async () => {
  const received = []
  const f = fixture(async (message) => received.push(message))
  f.client.start('ws://one')
  f.sockets[0].onmessage({ data: 'not json' })
  f.sockets[0].onmessage({ data: '{"messageType":17}' })
  await f.client.settled()
  assert.equal(f.errors.length, 1)
  assert.deepEqual(received, [{ messageType: 17 }])
})

test('queued persistence after logout is discarded', async () => {
  const received = []
  const f = fixture(async (message) => received.push(message))
  f.client.start('ws://one')
  f.sockets[0].onmessage({ data: '{"messageType":2}' })
  f.client.stop()
  await f.client.settled()
  assert.deepEqual(received, [])
})
