import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeHistoryMessages } from '../src/renderer/src/utils/historyPaging.mjs'

test('own HTTP and WebSocket text acceptance render one message in either arrival order', () => {
  const http = { messageId: 101, clientMessageId: 'stable-key', messageType: 2, messageContent: 'hello', sendUserId: 'Uself', status: 1 }
  const echo = { ...http, sessionId: 's', contactId: 'Upeer' }
  for (const frames of [[http, echo], [echo, http]]) {
    let rows = []
    for (const frame of frames) rows = mergeHistoryMessages(rows, [frame])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].clientMessageId, 'stable-key')
    assert.equal(rows[0].messageContent, 'hello')
  }
})

test('completion metadata wins over placeholder/history/late upload failure in the visible file bubble', () => {
  const pending = { messageId: 102, messageType: 5, fileName: 'clip.mov', fileType: 1, fileSize: 1000, status: 0, filePath: '/source/clip.mov' }
  const complete = { messageId: 102, messageType: 6, fileName: 'clip.mov', fileType: 1, fileSize: 640, status: 1 }
  for (const frames of [[pending, complete, pending], [complete, pending]]) {
    let rows = []
    for (const frame of frames) rows = mergeHistoryMessages(rows, [frame])
    rows = mergeHistoryMessages(rows, [{ messageId: 102, status: 2, uploadError: 'late timeout' }])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].messageType, 5)
    assert.equal(rows[0].status, 1)
    assert.equal(rows[0].fileSize, 640)
    assert.equal(rows[0].fileName, 'clip.mov')
    assert.equal(rows[0].filePath, '/source/clip.mov')
    assert.equal(rows[0].uploadError, undefined)
  }
})
