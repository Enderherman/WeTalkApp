import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, readFile, readdir, unlink, rmdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { downloadUpdatePackage, externalHttpUrl } from '../src/main/utils/updateDownload.mjs'

test('update download validates bytes and produces a real path only on completion', async () => {
  const bytes = Buffer.from('test installer bytes')
  const server = createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      if (req.url === '/denied') { res.setHeader('Content-Type', 'application/json'); res.end('{"code":600}'); return }
      assert.equal(req.headers.token, 'test-token')
      res.setHeader('Content-Type', 'application/octet-stream')
      res.end(bytes)
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wetalk-update-test-'))
  const base = { url: `http://127.0.0.1:${server.address().port}`, id: 1, fileName: 'update.exe', token: 'test-token', directory }
  let result
  try {
    const progress = []
    result = await downloadUpdatePackage({ ...base, expectedSize: bytes.length, onProgress: (item) => progress.push(item) })
    assert.equal((await readFile(result)).toString(), bytes.toString())
    assert.equal(progress.at(-1).progress, 100)
    await assert.rejects(downloadUpdatePackage({ ...base, expectedSize: bytes.length + 10 }), /不完整/)
    assert.equal((await readdir(directory)).length, 1)
    await assert.rejects(downloadUpdatePackage({ ...base, url: `${base.url}/denied` }), /不可下载/)
    for (const fileName of ['../outside.exe', '..\\outside.exe', 'C:outside.exe', 'update.exe.']) {
      await assert.rejects(downloadUpdatePackage({ ...base, fileName }), /文件名/)
    }
  } finally {
    await new Promise((resolve) => server.close(resolve))
    if (result) { await unlink(result); await rmdir(path.dirname(result)) }
    await rmdir(directory)
  }
})

test('external links accept HTTP(S) and reject executable protocols or credentials', () => {
  assert.equal(externalHttpUrl('https://example.com/release'), 'https://example.com/release')
  for (const value of ['javascript:alert(1)', 'file:///C:/test.exe', 'data:text/html,test', 'https://user:pass@example.com', 'invalid']) assert.equal(externalHttpUrl(value), null)
})
