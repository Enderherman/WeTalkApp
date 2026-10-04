import http from 'node:http'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { pipeline } from 'node:stream/promises'

export class MediaRequestError extends Error {
  constructor(status, message = '本地文件请求失败') { super(message); this.status = status }
}

function safeId(partType, value) {
  const id = String(value ?? '')
  if (partType === 'chat') {
    if (!/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new MediaRequestError(400)
  } else if (partType === 'avatar') {
    if (!/^[UG][A-Za-z0-9]+(?:_temp(?:_cover)?)?$/.test(id) || id.length > 128) throw new MediaRequestError(400)
  } else if (partType === 'tmp') {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(id) || id.includes('..')) throw new MediaRequestError(400)
  } else throw new MediaRequestError(400)
  return id
}

export function parseMediaQuery(searchParams) {
  for (const key of ['partType', 'fileType', 'fileId', 'showCover', 'forceGet']) {
    if (searchParams.getAll(key).length > 1) throw new MediaRequestError(400)
  }
  const partType = searchParams.get('partType')
  const fileId = safeId(partType, searchParams.get('fileId'))
  const fileType = searchParams.get('fileType') ?? '0'
  if (!['0', '1', '2'].includes(fileType)) throw new MediaRequestError(400)
  const bool = (key) => {
    const value = searchParams.get(key)
    if (value !== null && value !== 'true' && value !== 'false') throw new MediaRequestError(400)
    return value === 'true'
  }
  return { partType, fileId, fileType: Number(fileType), showCover: bool('showCover'), forceGet: bool('forceGet') }
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

export async function assertMediaPath(directory, filePath) {
  if (!directory || !path.isAbsolute(directory) || !isInside(path.resolve(directory), path.resolve(filePath))) throw new MediaRequestError(400)
  const root = await fs.realpath(directory)
  const parent = await fs.realpath(path.dirname(filePath))
  if (!isInside(root, parent)) throw new MediaRequestError(403)
  try {
    if (!isInside(root, await fs.realpath(filePath))) throw new MediaRequestError(403)
  } catch (error) { if (error.code !== 'ENOENT') throw error }
}

export async function resolveMediaPath({ directory, partType, fileId, showCover = false, loadMessage }) {
  const id = safeId(partType, fileId)
  if (!directory || !path.isAbsolute(directory)) throw new MediaRequestError(401)
  let folder, name
  if (partType === 'chat') {
    const message = await loadMessage(id)
    if (!message) throw new MediaRequestError(404)
    const date = new Date(Number(message.sendTime))
    if (!Number.isFinite(date.getTime()) || date.getFullYear() < 1000 || date.getFullYear() > 9999) throw new MediaRequestError(404)
    folder = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`
    const extension = path.extname(String(message.fileName || '')).toLowerCase()
    name = id + (/^\.[a-z0-9]{1,16}$/.test(extension) ? extension : '.bin')
  } else {
    folder = partType === 'avatar' ? 'avatar' : 'temp'
    name = partType === 'avatar' ? `${id}.png` : id
  }
  if (showCover) name += '_cover.png'
  await fs.mkdir(directory, { recursive: true })
  const folderPath = path.join(directory, folder)
  try {
    const realRoot = await fs.realpath(directory)
    if (!isInside(realRoot, await fs.realpath(folderPath))) throw new MediaRequestError(403)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    await fs.mkdir(folderPath).catch((mkdirError) => { if (mkdirError.code !== 'EEXIST') throw mkdirError })
  }
  const filePath = path.join(folderPath, name)
  await assertMediaPath(directory, filePath)
  return filePath
}

export function parseByteRange(header, size) {
  if (header === undefined) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (!match || (!match[1] && !match[2]) || size === 0) throw new MediaRequestError(416)
  let start, end
  if (!match[1]) {
    const suffix = Number(match[2])
    if (!Number.isSafeInteger(suffix) || suffix <= 0) throw new MediaRequestError(416)
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] ? Number(match[2]) : size - 1
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) throw new MediaRequestError(416)
    end = Math.min(end, size - 1)
  }
  return { start, end }
}

const mediaTypes = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.m4b': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac', '.wma': 'audio/x-ms-wma'
}

async function contentType(file, filePath, query) {
  if (query.fileType === 2 && !query.showCover && query.partType === 'chat') return 'application/octet-stream'
  const header = Buffer.alloc(12)
  await file.read(header, 0, 12, 0)
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'image/jpeg'
  if (header.subarray(0, 4).equals(Buffer.from([137, 80, 78, 71]))) return 'image/png'
  if (header.subarray(0, 3).toString() === 'GIF') return 'image/gif'
  if (header.subarray(0, 2).toString() === 'BM') return 'image/bmp'
  if (header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WEBP') return 'image/webp'
  return mediaTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
}

function respondError(response, error) {
  if (response.destroyed) return
  if (response.headersSent) { response.destroy(); return }
  const status = error instanceof MediaRequestError ? error.status
    : error.code === 'ENOENT' ? 404 : error.code === 'EACCES' || error.code === 'EPERM' ? 403 : 500
  response.statusCode = status
  response.removeHeader('Content-Length')
  if (status !== 416) response.removeHeader('Content-Range')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify({ code: status, message: status === 404 ? '文件不存在' : '本地文件请求失败' }))
}

export function createLocalMediaServer({ getContext, resolveFile, downloadFile, allowedOrigins = () => [] }) {
  const downloads = new Map()
  const server = http.createServer(async (request, response) => {
    let handle
    try {
      response.setHeader('X-Content-Type-Options', 'nosniff')
      response.setHeader('Cache-Control', 'no-store')
      const origin = request.headers.origin
      if (origin && !allowedOrigins().includes(origin)) throw new MediaRequestError(403)
      if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin') }
      const url = new URL(request.url, 'http://127.0.0.1')
      if (url.pathname !== '/file') throw new MediaRequestError(404)
      if (!['GET', 'HEAD'].includes(request.method)) { response.setHeader('Allow', 'GET, HEAD'); throw new MediaRequestError(405) }
      const query = parseMediaQuery(url.searchParams)
      const context = getContext()
      if (!context?.directory || !context?.isActive?.()) throw new MediaRequestError(401)
      const filePath = await resolveFile(query, context)
      if (!context.isActive()) throw new MediaRequestError(401)
      await assertMediaPath(context.directory, filePath)
      let missing = false
      try { await fs.access(filePath) } catch (error) { if (error.code !== 'ENOENT') throw error; missing = true }
      if (missing || query.forceGet) {
        if (query.partType === 'tmp') throw new MediaRequestError(404)
        const key = `${context.accountId}:${filePath}`
        if (!downloads.has(key)) {
          const pending = Promise.resolve().then(() => downloadFile(query, filePath, context)).finally(() => downloads.delete(key))
          downloads.set(key, pending)
        }
        await downloads.get(key)
      }
      if (!context.isActive()) throw new MediaRequestError(401)
      await assertMediaPath(context.directory, filePath)
      handle = await fs.open(filePath, 'r')
      const stat = await handle.stat()
      if (!stat.isFile()) throw new MediaRequestError(404)
      response.setHeader('Accept-Ranges', 'bytes')
      let range
      try { range = parseByteRange(request.headers.range, stat.size) }
      catch (error) { response.setHeader('Content-Range', `bytes */${stat.size}`); throw error }
      response.setHeader('Content-Type', await contentType(handle, filePath, query))
      response.setHeader('Content-Length', range ? range.end - range.start + 1 : stat.size)
      response.statusCode = range ? 206 : 200
      if (range) response.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`)
      if (request.method === 'HEAD' || stat.size === 0) { response.end(); return }
      const stream = handle.createReadStream(range || { start: 0 })
      handle = null // The stream now owns and closes the file descriptor.
      await pipeline(stream, response)
    } catch (error) { respondError(response, error) }
    finally { if (handle) await handle.close().catch(() => {}) }
  })
  return server
}

export async function listenLocalMediaServer(options, port) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new MediaRequestError(400)
  const server = createLocalMediaServer(options)
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve() })
  })
  return server
}
