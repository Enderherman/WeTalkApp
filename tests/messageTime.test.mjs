import test from 'node:test'
import assert from 'node:assert/strict'
import { formatMessageTime, shouldShowMessageTime } from '../src/renderer/src/utils/messageTime.mjs'
const msg = (value) => ({ sendTime: new Date(value).getTime() })
test('first and second messages receive time dividers when appropriate', () => {
  assert.equal(shouldShowMessageTime(msg('2026-10-04T10:00:00')), true)
  assert.equal(shouldShowMessageTime(msg('2026-10-04T10:06:00'), msg('2026-10-04T10:00:00')), true)
  assert.equal(shouldShowMessageTime(msg('2026-10-04T10:01:00'), msg('2026-10-04T10:00:00')), false)
  assert.equal(shouldShowMessageTime(msg('2026-10-05T00:01:00'), msg('2026-10-04T23:59:00')), true)
})
test('yesterday labels cross month and year boundaries and preserve clock time', () => {
  assert.equal(formatMessageTime(new Date('2026-09-30T23:15:00'), new Date('2026-10-01T10:00:00')), '昨天 23:15')
  assert.equal(formatMessageTime(new Date('2025-12-31T12:30:00'), new Date('2026-01-01T10:00:00')), '昨天 12:30')
  assert.equal(formatMessageTime(new Date('2026-10-01T09:30:00'), new Date('2026-10-04T10:00:00')), '2026/10/01 09:30')
})
