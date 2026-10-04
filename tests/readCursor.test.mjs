import test from 'node:test'
import assert from 'node:assert/strict'
import { createReadCursorWriter, canMarkVisibleSession } from '../src/renderer/src/utils/readCursor.mjs'

test('read cursors coalesce in-flight messages and never move backwards', async () => {
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const sent = [], confirmed = []
  const writer = createReadCursorWriter({ send: async (contact, id) => { sent.push(id); if (id === 2) await gate; return true }, onConfirmed: (contact, id) => confirmed.push(id) })
  const first = writer.mark('Upeer', 2)
  await writer.mark('Upeer', 4); await writer.mark('Upeer', 3)
  release(); await first
  await writer.mark('Upeer', 3)
  assert.deepEqual(sent, [2, 4])
  assert.deepEqual(confirmed, [2, 4])
})

test('failed read keeps pending cursor for reconnect retry; logout discards it', async () => {
  let succeeds = false
  const confirmed = []
  const writer = createReadCursorWriter({ send: async () => { if (!succeeds) throw new Error('offline'); return true }, onConfirmed: (contact, id) => confirmed.push(id) })
  await writer.mark('Upeer', 8)
  assert.deepEqual(confirmed, [])
  succeeds = true; await writer.retry()
  assert.deepEqual(confirmed, [8])
  writer.dispose(); await writer.mark('Upeer', 10)
  assert.deepEqual(confirmed, [8])
})

test('hidden, blurred or inactive chat never marks messages read', () => {
  const active = { active: true, visible: true, focused: true, contactId: 'Upeer' }
  assert.equal(canMarkVisibleSession(active), true)
  for (const key of ['active', 'visible', 'focused', 'contactId']) assert.equal(canMarkVisibleSession({ ...active, [key]: false }), false)
})
