import test from 'node:test'
import assert from 'node:assert/strict'
import { validateChatUpload, validateAvatarFile, createAvatarSelection } from '../src/renderer/src/utils/uploadValidation.mjs'
const MB = 1024 * 1024

test('desktop upload limits match browser hard caps without changing administrator values', () => {
  const limits = { maxImageSize: 999, maxVideoSize: 500, maxFileSize: 5000 }
  assert.equal(validateChatUpload({ name: 'image.png', size: 200 * MB }, 0, limits), null)
  assert.ok(validateChatUpload({ name: 'image.png', size: 201 * MB }, 0, limits))
  assert.equal(validateChatUpload({ name: 'file.bin', size: 499 * MB }, 2, limits), null)
  assert.ok(validateChatUpload({ name: 'file.bin', size: 500 * MB }, 2, limits))
  assert.ok(validateChatUpload({ name: 'clip.mp4', size: 11 * MB }, 1, { maxVideoSize: 10 }))
  assert.equal(limits.maxFileSize, 5000)
  for (const file of [{ name: '', size: 1 }, { name: 'test.txt', size: 0 }, { name: 'test.invalid-extension', size: 1 }]) assert.ok(validateChatUpload(file, 2))
})

test('avatar input enforces matching type and 10 MiB limit', () => {
  assert.equal(validateAvatarFile({ name: 'test.PNG', type: 'image/png', size: 10 * MB }), null)
  assert.ok(validateAvatarFile({ name: 'test.png', type: 'text/plain', size: 1 }))
  assert.ok(validateAvatarFile({ name: 'test.png', type: 'image/png', size: 10 * MB + 1 }))
})

test('avatar selection ignores stale responses and emits correctly typed PNG files', async () => {
  const gates = [], received = [], state = {}
  const selection = createAvatarSelection({ state, createCover: () => new Promise((resolve) => gates.push(resolve)), onResult: (value) => received.push(value) })
  const file = { name: 'test.png', type: 'image/png', size: 1, path: 'test.png' }
  const first = selection.select(file), second = selection.select(file)
  gates[1]({ avatarStream: new Uint8Array([1, 2]), coverStream: new Uint8Array([3]) }); await second
  gates[0]({ avatarStream: new Uint8Array([4]), coverStream: new Uint8Array([5]) }); await first
  assert.equal(received.length, 1)
  assert.equal(received[0].avatarFile.type, 'image/png')
  assert.equal(received[0].coverFile.name, 'cover.png')
  assert.equal(received[0].avatarFile.size, 2)
})
