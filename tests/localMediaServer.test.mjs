import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { createServer } from 'node:http'
import { MediaRequestError, listenLocalMediaServer, resolveMediaPath } from '../src/main/utils/localMediaServer.mjs'
import { downloadMediaToCache } from '../src/main/utils/mediaDownload.mjs'

async function fixture(t, overrides = {}) {
  const directory = await fs.mkdtemp(path.join(tmpdir(), 'wetalk-media-test-'))
  const file = path.join(directory, 'sample.mp3')
  await fs.writeFile(file, '0123456789')
  const context = { accountId: 'U100', directory, token: 'test-token', isActive: () => true }
  const server = await listenLocalMediaServer({
    getContext: () => context, resolveFile: async () => file,
    downloadFile: async () => { throw new Error('Unexpected download') },
    allowedOrigins: () => ['http://127.0.0.1:5173'], ...overrides
  }, 0)
  t.after(async () => {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections?.() })
    assert(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep + 'wetalk-media-test-'))
    await fs.rm(directory, { recursive: true, force: true })
  })
  return { directory, file, context, server, url: `http://127.0.0.1:${server.address().port}/file?partType=chat&fileId=1&fileType=1` }
}

test('binds only loopback and serves full, head, open, suffix, clipped and invalid ranges over real HTTP', async (t) => {
  const { url, server, file } = await fixture(t)
  assert.equal(server.address().address, '127.0.0.1')
  const full = await fetch(url)
  assert.equal(full.status, 200)
  assert.equal(full.headers.get('content-type'), 'audio/mpeg')
  assert.equal(full.headers.get('content-length'), '10')
  assert.equal(full.headers.get('accept-ranges'), 'bytes')
  assert.equal(await full.text(), '0123456789')
  const head = await fetch(url, { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(head.headers.get('content-length'), '10')
  assert.equal(await head.text(), '')
  for (const [range, expected, contentRange] of [
    ['bytes=2-4', '234', 'bytes 2-4/10'], ['bytes=7-', '789', 'bytes 7-9/10'],
    ['bytes=-3', '789', 'bytes 7-9/10'], ['bytes=8-999', '89', 'bytes 8-9/10'], ['bytes=-99', '0123456789', 'bytes 0-9/10']
  ]) {
    const response = await fetch(url, { headers: { range } })
    assert.equal(response.status, 206, range)
    assert.equal(response.headers.get('content-range'), contentRange)
    assert.equal(await response.text(), expected)
  }
  for (const range of ['bytes=10-', 'bytes=5-1', 'bytes=-0', 'bytes=0-1,3-4', 'bytes=nope', 'items=0-1', 'bytes=9007199254740992-']) {
    const response = await fetch(url, { headers: { range } })
    assert.equal(response.status, 416, range)
    assert.equal(response.headers.get('content-range'), 'bytes */10')
    await response.arrayBuffer()
  }
  await fs.writeFile(file, '')
  const emptyRange = await fetch(url, { headers: { range: 'bytes=0-' } })
  assert.equal(emptyRange.status, 416)
  assert.equal(emptyRange.headers.get('content-range'), 'bytes */0')
  await emptyRange.arrayBuffer()
  const empty = await fetch(url)
  assert.equal(empty.status, 200)
  assert.equal(empty.headers.get('content-length'), '0')
  assert.equal(await empty.text(), '')
})

test('rejects malformed parameters and untrusted origins without accessing files', async (t) => {
  let calls = 0
  const { url } = await fixture(t, { resolveFile: async () => { calls++; throw new MediaRequestError(404) } })
  for (const query of ['', '?partType=bad&fileId=1', '?partType=chat&fileId=../secret', '?partType=avatar&fileId=U1/../../secret',
    '?partType=tmp&fileId=C:%5Csecret', '?partType=chat&fileId=1&fileId=2', '?partType=chat&fileId=1&showCover=maybe',
    '?partType=chat&fileId=1&fileType=8']) {
    const response = await fetch(url.split('?')[0] + query)
    assert.equal(response.status, 400, query)
    await response.arrayBuffer()
  }
  assert.equal(calls, 0)
  const untrusted = await fetch(url, { headers: { Origin: 'https://example.invalid' } })
  assert.equal(untrusted.status, 403)
  assert.equal(untrusted.headers.get('access-control-allow-origin'), null)
  await untrusted.arrayBuffer()
  const trusted = await fetch(url, { headers: { Origin: 'http://127.0.0.1:5173' } })
  assert.equal(trusted.status, 404)
  assert.equal(trusted.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173')
  await trusted.arrayBuffer()
})

test('returns bounded JSON errors for missing metadata and asynchronous resolver failures', async (t) => {
  const missing = await fixture(t, { resolveFile: async () => { throw new MediaRequestError(404) } })
  assert.equal((await fetch(missing.url)).status, 404)
  const failed = await fixture(t, { resolveFile: async () => { throw new Error('private SQL/file details') } })
  const response = await fetch(failed.url)
  assert.equal(response.status, 500)
  assert(!((await response.text()).includes('private SQL')))
  const downloadFailure = await fixture(t, { downloadFile: async () => { throw new Error('private token and URL') } })
  const rejected = await fetch(`${downloadFailure.url}&forceGet=true`)
  assert.equal(rejected.status, 500)
  assert(!(await rejected.text()).includes('private token'))
})

test('reports a busy local port instead of an unhandled server error', async (t) => {
  const { server } = await fixture(t)
  await assert.rejects(listenLocalMediaServer({}, server.address().port), { code: 'EADDRINUSE' })
})

test('keeps generated paths inside the account cache and rejects symlink/junction escapes', async (t) => {
  const { directory } = await fixture(t)
  const loadMessage = async () => ({ fileName: '../outside/secret.txt', sendTime: 1791000000000 })
  const resolved = await resolveMediaPath({ directory, partType: 'chat', fileId: 22, loadMessage })
  assert.equal(path.basename(resolved), '22.txt')
  assert(!path.relative(directory, resolved).startsWith('..'))
  await assert.rejects(resolveMediaPath({ directory, partType: 'chat', fileId: 23, loadMessage: async () => null }), { status: 404 })
  await assert.rejects(resolveMediaPath({ directory, partType: 'tmp', fileId: '../outside.txt' }), { status: 400 })
  const outside = path.join(directory, 'other-account')
  const cache = path.join(directory, 'account')
  await fs.mkdir(outside)
  await fs.mkdir(cache)
  await fs.symlink(outside, path.join(cache, 'avatar'), process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(resolveMediaPath({ directory: cache, partType: 'avatar', fileId: 'U100' }), { status: 403 })
})

test('coalesces simultaneous downloads and prevents late responses after an account switch', async (t) => {
  let active = true, downloads = 0, release
  const blocked = new Promise((resolve) => { release = resolve })
  let context
  const rig = await fixture(t, {
    getContext: () => context,
    resolveFile: async () => path.join(context.directory, 'new.mp3'),
    downloadFile: async (_query, file) => { downloads++; await blocked; await fs.writeFile(file, 'downloaded') }
  })
  context = { ...rig.context, isActive: () => active }
  const requests = [fetch(rig.url), fetch(rig.url)]
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(downloads, 1)
  active = false
  release()
  for (const response of await Promise.all(requests)) { assert.equal(response.status, 401); await response.arrayBuffer() }
})

test('downloads with real multipart HTTP, recognizes JSON charset errors and preserves old caches on interrupted streams', async (t) => {
  const { directory } = await fixture(t)
  let mode = 'success'
  const upstream = createServer((request, response) => {
    assert.equal(request.headers.token, 'test-token')
    assert.match(request.headers['content-type'], /multipart\/form-data; boundary=/)
    request.resume()
    request.on('end', () => {
      if (mode === 'success') { response.setHeader('content-type', 'application/octet-stream'); response.end('valid bytes'); return }
      if (mode === 'truncated') {
        response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': 100 })
        response.write('partial')
        setTimeout(() => response.destroy(), 10)
        return
      }
      response.setHeader('content-type', 'application/json;charset=UTF-8')
      response.end(JSON.stringify({ code: mode === 'expired' ? 901 : mode === 'missing-avatar' ? 602 : 404, message: 'private error detail' }))
    })
  })
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => { upstream.close(resolve); upstream.closeAllConnections?.() }))
  const savePath = path.join(directory, 'cache.mp3')
  const options = { url: `http://127.0.0.1:${upstream.address().port}/download`, fileId: '1', showCover: false,
    savePath, partType: 'chat', token: 'test-token', directory }
  await downloadMediaToCache(options)
  assert.equal(await fs.readFile(savePath, 'utf8'), 'valid bytes')
  mode = 'truncated'
  await assert.rejects(downloadMediaToCache(options))
  assert.equal(await fs.readFile(savePath, 'utf8'), 'valid bytes')
  assert(!(await fs.readdir(directory)).some((name) => name.endsWith('.part')))
  mode = 'expired'
  await assert.rejects(downloadMediaToCache(options), { status: 401 })
  mode = 'missing'
  await assert.rejects(downloadMediaToCache(options), { status: 404 })
  const fallback = path.join(directory, 'fallback.png')
  await fs.writeFile(fallback, 'default avatar')
  mode = 'missing-avatar'
  await downloadMediaToCache({ ...options, partType: 'avatar', fallbackAvatarPath: fallback })
  assert.equal(await fs.readFile(savePath, 'utf8'), 'default avatar')
})
