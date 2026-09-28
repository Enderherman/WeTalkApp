import assert from 'node:assert/strict'
import http from 'node:http'
import { test } from 'node:test'
import { normalizeApiOrigin, startDesktopApiServer } from '../src/main/utils/desktopApiServer.mjs'

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
}

test('serves renderer files from a loopback-only origin', async () => {
  const desktopServer = await startDesktopApiServer({
    apiOrigin: 'http://127.0.0.1:5050',
    rendererDirectory: process.cwd()
  })

  try {
    assert.match(desktopServer.origin, /^http:\/\/127\.0\.0\.1:\d+$/)
    const response = await fetch(`${desktopServer.origin}/README.md`)
    assert.equal(response.status, 200)
    assert.match(await response.text(), /WeTalkApp/)
  } finally {
    await desktopServer.close()
  }
})

test('proxies API method, query, headers, and streamed request body', async () => {
  let receivedRequest
  const backend = http.createServer((request, response) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      receivedRequest = {
        method: request.method,
        url: request.url,
        token: request.headers.token,
        body: Buffer.concat(chunks).toString('utf8')
      }
      response.writeHead(201, {
        'Content-Type': 'application/json',
        'X-Backend-Request-Id': 'request-42'
      })
      response.end('{"code":200}')
    })
  })
  await listen(backend)
  const backendAddress = backend.address()
  const desktopServer = await startDesktopApiServer({
    apiOrigin: `http://127.0.0.1:${backendAddress.port}`,
    rendererDirectory: process.cwd()
  })

  try {
    const response = await fetch(`${desktopServer.origin}/api/chat/sendMessage?cursor=42`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: 'desktop-test-token'
      },
      body: '{"message":"hello"}'
    })

    assert.equal(response.status, 201)
    assert.equal(response.headers.get('x-backend-request-id'), 'request-42')
    assert.deepEqual(receivedRequest, {
      method: 'POST',
      url: '/api/chat/sendMessage?cursor=42',
      token: 'desktop-test-token',
      body: '{"message":"hello"}'
    })
    assert.deepEqual(await response.json(), { code: 200 })
  } finally {
    await desktopServer.close()
    await close(backend)
  }
})

test('accepts only plain HTTP or HTTPS API origins', () => {
  assert.equal(normalizeApiOrigin('https://chat.example.test').origin, 'https://chat.example.test')
  assert.throws(() => normalizeApiOrigin('file:///tmp/backend'), /HTTP 或 HTTPS/)
  assert.throws(() => normalizeApiOrigin('http://user:password@example.test'), /HTTP 或 HTTPS/)
  assert.throws(() => normalizeApiOrigin('http://example.test/api'), /HTTP 或 HTTPS/)
})

if (process.env.WETALK_SERVER_ORIGIN) {
  test('proxies the live backend readiness endpoint through the renderer origin', async () => {
    const desktopServer = await startDesktopApiServer({
      apiOrigin: process.env.WETALK_SERVER_ORIGIN,
      rendererDirectory: process.cwd()
    })

    try {
      const response = await fetch(`${desktopServer.origin}/api/actuator/health/readiness`)
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { status: 'UP' })
    } finally {
      await desktopServer.close()
    }
  })
}
