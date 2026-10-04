import test from 'node:test'
import assert from 'node:assert/strict'
import { createHistoryPager, mergeHistoryMessages } from '../src/renderer/src/utils/historyPaging.mjs'

test('server history pages use decreasing cursors and stop on the final page', async () => {
  const state = {}, cursors = [], delivered = []
  const pager = createHistoryPager({ state, pageSize: 2, fetchPage: async (contact, before) => { cursors.push([contact, before]); return { list: before === null ? [{ messageId: 3 }, { messageId: 4 }] : [{ messageId: 1 }] } }, onPage: (list) => delivered.push(...list) })
  pager.reset('Upeer')
  await pager.load(); await pager.load(); await pager.load()
  assert.deepEqual(cursors, [['Upeer', null], ['Upeer', 3]])
  assert.equal(state.hasMore, false)
  assert.equal(delivered.length, 3)
})

test('switching conversation discards old response and failure uses cache without exhausting history', async () => {
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const state = {}, delivered = [], failures = []
  const pager = createHistoryPager({ state, fetchPage: async () => { await gate; return { list: [{ messageId: 1 }] } }, onPage: (list) => delivered.push(...list), onFailure: (event) => failures.push(event) })
  pager.reset('Uold')
  const pending = pager.load()
  pager.reset('Unew')
  release(); await pending
  assert.deepEqual(delivered, [])
  const failed = createHistoryPager({ state, fetchPage: async () => null, onPage: () => {}, onFailure: (event) => failures.push(event) })
  failed.reset('Unew'); await failed.load()
  assert.equal(state.hasMore, true)
  assert.equal(state.loading, false)
  assert.deepEqual(failures, [{ contactId: 'Unew' }])
})

test('merging cached/server/live pages deduplicates IDs and preserves local attachment path', () => {
  assert.deepEqual(mergeHistoryMessages([{ messageId: 2, filePath: '/file.txt', status: 0 }, { messageId: 4 }], [{ messageId: 1 }, { messageId: 2, status: 1 }]), [{ messageId: 1 }, { messageId: 2, filePath: '/file.txt', status: 1 }, { messageId: 4 }])
})
