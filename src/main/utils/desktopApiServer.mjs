import express from 'express'
import http from 'node:http'
import https from 'node:https'

const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
])

export function normalizeApiOrigin(value) {
  let origin
  try {
    origin = new URL(value)
  } catch {
    throw new Error('WeTalk API 地址必须是有效的 HTTP 或 HTTPS origin')
  }

  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    !['', '/'].includes(origin.pathname) ||
    origin.search ||
    origin.hash
  ) {
    throw new Error('WeTalk API 地址必须只包含 HTTP 或 HTTPS origin')
  }

  return origin
}

function withoutHopByHopHeaders(headers) {
  const copied = { ...headers }
  const connectionHeaders = String(copied.connection || '')
    .split(',')
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean)

  for (const header of [...hopByHopHeaders, ...connectionHeaders]) {
    delete copied[header]
  }

  return copied
}

function proxyApiRequest(request, response, apiOrigin) {
  const requestUrl = new URL(request.url, 'http://127.0.0.1')
  if (requestUrl.pathname !== '/api' && !requestUrl.pathname.startsWith('/api/')) return false

  const upstreamUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, apiOrigin)
  const transport = upstreamUrl.protocol === 'https:' ? https : http
  const headers = withoutHopByHopHeaders(request.headers)
  headers.host = upstreamUrl.host

  const upstreamRequest = transport.request(upstreamUrl, {
    method: request.method,
    headers
  }, (upstreamResponse) => {
    response.writeHead(
      upstreamResponse.statusCode || 502,
      withoutHopByHopHeaders(upstreamResponse.headers)
    )
    upstreamResponse.pipe(response)
  })

  upstreamRequest.on('error', () => {
    if (response.headersSent) {
      response.destroy()
      return
    }

    response.statusCode = 502
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end('{"code":502,"message":"后端服务暂不可用"}')
  })

  request.on('aborted', () => upstreamRequest.destroy())
  response.on('close', () => {
    if (!response.writableEnded) upstreamRequest.destroy()
  })
  request.pipe(upstreamRequest)
  return true
}

export async function startDesktopApiServer({ apiOrigin, rendererDirectory }) {
  const upstreamOrigin = normalizeApiOrigin(apiOrigin)
  const serverApp = express()
  serverApp.disable('x-powered-by')
  serverApp.use((request, response, next) => {
    if (!proxyApiRequest(request, response, upstreamOrigin)) next()
  })
  serverApp.use(express.static(rendererDirectory, { index: 'index.html' }))

  const server = http.createServer(serverApp)
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    await new Promise((resolve) => server.close(resolve))
    throw new Error('WeTalk 本地服务未能取得有效的监听端口')
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
}
