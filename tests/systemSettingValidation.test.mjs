import test from 'node:test'
import assert from 'node:assert/strict'
import { quotaFields, normalizeSystemSettings, isPositiveQuota } from '../src/renderer/src/utils/systemSettingValidation.mjs'

const valid = { maxGroupCount: 5, maxGroupMemberCount: 500, maxImageSize: 200, maxVideoSize: 500, maxFileSize: 5000, robotNickName: '机器人', robotWelcome: '欢迎' }

test('all quota fields reject zero, negatives, fractions, blanks and integer overflow', () => {
  for (const field of quotaFields) {
    for (const value of [0, -1, 1.5, '', ' ', null, 'abc', 2147483648]) assert.throws(() => normalizeSystemSettings({ ...valid, [field]: value }), /正整数/)
  }
  assert.equal(isPositiveQuota('12'), true)
  assert.equal(normalizeSystemSettings({ ...valid, maxFileSize: '123' }).maxFileSize, 123)
})

test('robot nickname and welcome enforce trimmed nonempty length and retain selected avatar', () => {
  const avatar = new Blob(['bytes'])
  const result = normalizeSystemSettings({ ...valid, robotNickName: '  名称  ', robotWelcome: '  欢迎  ', robotFile: avatar })
  assert.equal(result.robotNickName, '名称')
  assert.equal(result.robotWelcome, '欢迎')
  assert.equal(result.robotFile, avatar)
  for (const value of [' ', 'x'.repeat(21)]) assert.throws(() => normalizeSystemSettings({ ...valid, robotNickName: value }), /昵称/)
  for (const value of [' ', 'x'.repeat(301)]) assert.throws(() => normalizeSystemSettings({ ...valid, robotWelcome: value }), /欢迎/)
})
