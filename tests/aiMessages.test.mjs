import test from 'node:test'
import assert from 'node:assert/strict'
import { aiMessageState, createAiStopper } from '../src/renderer/src/utils/aiMessages.mjs'

test('AI states cover initial, cumulative, completed, cancelled, failed and historical robot messages', () => {
  assert.equal(aiMessageState({ messageType: 14, status: 0 }), 'waiting')
  assert.equal(aiMessageState({ messageType: 14, status: 0, messageContent: 'partial' }), 'streaming')
  for (const [status, expected] of [[1, 'complete'], [2, 'cancelled'], [3, 'failed']]) assert.equal(aiMessageState({ messageType: 2, sendUserId: 'robot', status }, 'robot'), expected)
  assert.equal(aiMessageState({ messageType: 2, sendUserId: 'peer', status: 0 }, 'robot'), null)
  assert.equal(aiMessageState({ messageType: 5, sendUserId: 'robot', status: 0 }, 'robot'), null)
})

test('stop generation sends the message ID and respects already-completed server state', async () => {
  const state = { stoppingId: null, errors: {} }, delivered = []
  const stop = createAiStopper({ state, request: async (request) => { assert.equal(request.url, '/chat/cancelAiMessage'); assert.equal(request.params.messageId, 10); return { data: { status: 1, messageContent: 'finished' } } }, onMessage: (message) => delivered.push(message) })
  await stop({ messageId: 10, sessionId: 's', status: 0 })
  assert.equal(delivered[0].status, 1)
  assert.equal(delivered[0].messageType, 16)
  assert.equal(delivered[0].sessionId, 's')
  assert.equal(state.stoppingId, null)
})

test('stop failure is retryable and does not replace the existing response', async () => {
  const state = { stoppingId: null, errors: {} }
  const stop = createAiStopper({ state, request: async () => null, onMessage: () => { throw new Error('must not update') } })
  await stop({ messageId: 12 })
  assert.match(state.errors[12], /失败/)
  assert.equal(state.stoppingId, null)
})
