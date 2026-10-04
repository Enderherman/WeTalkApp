import test from 'node:test'
import assert from 'node:assert/strict'
import { createTextOutbox } from '../src/renderer/src/utils/textOutbox.mjs'

function fixture(send, saved = new Map()) {
  const state = { items: [], online: false, ready: false }, sent = []
  let count = 0
  const outbox = createTextOutbox({ state, storage: { load: async () => [...saved.values()].map((item) => ({ ...item })), put: async (item) => saved.set(item.clientMessageId, { ...item }), remove: async (id) => saved.delete(id) }, send, onSent: (message) => sent.push(message), id: () => `id-${++count}`, now: () => 1 })
  return { outbox, state, saved, sent }
}
const draft = (messageContent) => ({ contactId: 'Upeer', sessionId: 's', messageContent })

test('offline drafts are persisted before display and replay in order with stable keys', async () => {
  const calls = []
  const f = fixture(async (item) => { calls.push([item.clientMessageId, item.messageContent]); return { messageId: calls.length } })
  await f.outbox.load()
  await f.outbox.enqueue(draft('one')); await f.outbox.enqueue(draft('two'))
  assert.equal(f.saved.size, 2)
  assert.equal(calls.length, 0)
  await f.outbox.setOnline(true)
  assert.deepEqual(calls, [['id-1', 'one'], ['id-2', 'two']])
  assert.equal(f.saved.size, 0)
})

test('uncertain send failure retries the same key and blocks later drafts until resolved', async () => {
  let fail = true
  const calls = []
  const f = fixture(async (item) => { calls.push(item.clientMessageId); if (fail) throw new Error('timeout'); return { messageId: 99 } })
  await f.outbox.load(); await f.outbox.enqueue(draft('one')); await f.outbox.enqueue(draft('two'))
  await f.outbox.setOnline(true)
  assert.equal(f.state.items[0].status, 'failed')
  await f.outbox.flush()
  assert.deepEqual(calls, ['id-1'])
  fail = false
  await f.outbox.retry('id-1')
  assert.deepEqual(calls, ['id-1', 'id-1', 'id-2'])
  assert.equal(f.state.items.length, 0)
})

test('restarting restores queued drafts and logout prevents late response delivery', async () => {
  const first = fixture(async () => null)
  await first.outbox.load(); await first.outbox.enqueue(draft('preserved'))
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const restored = fixture(async () => { await gate; return { messageId: 5 } }, first.saved)
  await restored.outbox.load()
  assert.equal(restored.state.items[0].messageContent, 'preserved')
  const pending = restored.outbox.setOnline(true)
  restored.outbox.dispose(); release(); await pending
  assert.deepEqual(restored.sent, [])
  assert.equal(first.saved.size, 1)
})

test('discard removes only selected draft and invalid whitespace cannot enter queue', async () => {
  const f = fixture(async () => null)
  await f.outbox.load()
  await assert.rejects(f.outbox.enqueue(draft('   ')), /500/)
  await f.outbox.enqueue(draft('one')); await f.outbox.enqueue(draft('two'))
  await f.outbox.discard('id-1')
  assert.deepEqual([...f.saved.keys()], ['id-2'])
})

test('reconnection replays transient failures with the same idempotency key', async () => {
  let failed = true
  const ids = []
  const f = fixture(async (item) => { ids.push(item.clientMessageId); if (failed) throw Object.assign(new Error('offline'), { retryable: true }); return { messageId: 9 } })
  await f.outbox.load(); await f.outbox.enqueue(draft('one')); await f.outbox.setOnline(true)
  assert.equal(f.state.items[0].status, 'failed')
  await f.outbox.setOnline(false)
  failed = false; await f.outbox.setOnline(true)
  assert.deepEqual(ids, ['id-1', 'id-1'])
  assert.equal(f.state.items.length, 0)
})
