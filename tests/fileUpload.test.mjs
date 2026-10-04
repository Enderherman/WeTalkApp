import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import FormData from 'form-data'
import { uploadFileRequest, persistOutgoingFile } from '../src/main/utils/fileUpload.mjs'

test('multipart upload waits for server acknowledgement and rejects business errors', async () => {
  let release
  let requestArrived
  const arrived = new Promise((resolve) => { requestArrived = resolve })
  const server = createServer((req, res) => {
    assert.equal(req.headers.token, 'test-token')
    assert.match(req.headers['content-type'], /multipart\/form-data; boundary=/)
    req.resume()
    req.on('end', () => {
      if (req.url === '/fail') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ code: 600, message: '文件被拒绝' })); return }
      release = () => { res.setHeader('content-type', 'application/json'); res.end('{"code":200,"data":"ok"}') }
      requestArrived()
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}`
  const form = () => { const body = new FormData(); body.append('file', Buffer.from('file bytes'), 'test.txt'); return body }
  try {
    let finished = false
    const result = uploadFileRequest(url, form(), 'test-token').then((value) => { finished = true; return value })
    await arrived
    assert.equal(finished, false)
    release()
    assert.equal((await result).code, 200)
    await assert.rejects(uploadFileRequest(`${url}/fail`, form(), 'test-token'), /文件被拒绝/)
  } finally { await new Promise((resolve) => server.close(resolve)) }
})

test('failure persists retryable state and retry reuses the original message ID', async () => {
  const writes = [], callbacks = [], uploads = []
  let fail = true
  const args = {
    message: { messageId: 42, filePath: '/test.txt', fileType: 2 },
    save: async (message) => writes.push({ ...message }),
    upload: async (id) => { uploads.push(id); if (fail) throw new Error('断网') },
    update: async (value, params) => writes.push({ ...value, ...params }),
    notify: (value) => callbacks.push(value)
  }
  await persistOutgoingFile(args)
  assert.deepEqual(callbacks[0], { status: 2, messageId: 42, error: '断网' })
  fail = false
  await persistOutgoingFile(args)
  assert.deepEqual(uploads, [42, 42])
  assert.deepEqual(callbacks[1], { status: 1, messageId: 42 })
  assert.deepEqual(writes.map((item) => item.status), [0, 2, 0, 1])
})

test('an upload finishing after an account switch does not update the new account', async () => {
  let active = true
  const callbacks = []
  await persistOutgoingFile({ message: { messageId: 1 }, save: async () => {}, upload: async () => { active = false }, update: async () => { throw new Error('must not update') }, notify: (item) => callbacks.push(item), isActive: () => active })
  assert.deepEqual(callbacks, [])
})
