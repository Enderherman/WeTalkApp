import test from 'node:test'
import assert from 'node:assert/strict'
import { createHistorySearch } from '../src/renderer/src/utils/historySearch.mjs'

test('full-history search reads every cursor page across conversations and decodes text', async () => {
  const state = {}, calls = []
  const search = createHistorySearch({ state, pageSize: 2, fetchPage: async (contact, before) => {
    calls.push([contact, before])
    return { list: before === null ? [{ messageId: 3, messageContent: 'no' }, { messageId: 4, messageContent: '&lt;Match&gt;' }] : [{ messageId: 1, fileName: 'MATCH.txt' }] }
  } })
  await search.run([{ contactId: 'Uone', sessionId: 's1', contactName: 'name', remark: '同事' }, { contactId: 'Utwo', sessionId: 's2' }], 'match')
  assert.deepEqual(calls, [['Uone', null], ['Uone', 3], ['Utwo', null], ['Utwo', 3]])
  assert.equal(state.scanned, 6)
  assert.equal(state.results.length, 4)
  assert.equal(state.results[0].sourceContactName, '同事')
  assert.equal(state.results[0].searchText, '<Match>')
})

test('cancelled search cannot append late results', async () => {
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const state = {}
  const search = createHistorySearch({ state, fetchPage: async () => { await gate; return { list: [{ messageId: 1, messageContent: 'match' }] } } })
  const pending = search.run([{ contactId: 'Uone', sessionId: 's1' }], 'match')
  search.cancel(); release(); await pending
  assert.deepEqual(state.results, [])
  assert.equal(state.loading, false)
})

test('unavailable conversations report partial results and pagination cannot loop', async () => {
  const state = {}, calls = []
  const search = createHistorySearch({ state, pageSize: 1, fetchPage: async (contact) => { calls.push(contact); return contact === 'missing' ? null : { list: [{ messageId: 1, messageContent: 'match' }] } } })
  await search.run([{ contactId: 'missing' }, { contactId: 'available', sessionId: 's' }], 'match')
  assert.equal(state.results.length, 1)
  assert.deepEqual(calls, ['missing', 'available', 'available'])
  assert.ok(state.error)
})
