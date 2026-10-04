import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { createServer } from 'node:http'
import FormData from 'form-data'
import { appendCachedUploadFile } from '../src/main/utils/cachedUploadFile.mjs'
import { uploadFileRequest } from '../src/main/utils/fileUpload.mjs'

test('uploads original text, image and audio names with their MIME while reading message-ID cache files', async (t) => {
  const directory = await fs.mkdtemp(path.join(tmpdir(), 'wetalk-upload-name-test-'))
  const received = []
  const server = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    received.push(Buffer.concat(chunks).toString('utf8'))
    response.setHeader('content-type', 'application/json')
    response.end('{"code":200,"data":"ok"}')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections?.() })
    assert(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep + 'wetalk-upload-name-test-'))
    await fs.rm(directory, { recursive: true, force: true })
  })
  const files = [['用户原名.txt', 'text/plain'], ['holiday.png', 'image/png'], ['recording.wav', 'audio/wave'], ['camera.mjpeg', 'image/jpeg']]
  for (const [filename] of files) {
    const cachePath = path.join(directory, '100.bin')
    await fs.writeFile(cachePath, `body:${filename}`)
    const form = new FormData()
    appendCachedUploadFile(form, cachePath, filename)
    await uploadFileRequest(`http://127.0.0.1:${server.address().port}/upload`, form, 'test-token')
  }
  files.forEach(([filename, mime], index) => {
    assert(received[index].includes(`filename="${filename}"`))
    assert(received[index].includes(`Content-Type: ${mime}`))
    assert(received[index].includes(`body:${filename}`))
    assert(!received[index].includes('filename="100.bin"'))
  })
})

test('rejects header control characters in the preserved upload name before opening a stream', () => {
  assert.throws(() => appendCachedUploadFile(new FormData(), 'not-opened', 'file.txt\r\nInjected: yes'), /文件名无效/)
})
