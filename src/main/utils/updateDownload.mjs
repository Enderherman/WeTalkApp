import axios from 'axios'
import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, stat, unlink, rmdir } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'

export function externalHttpUrl(value) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : null
  } catch { return null }
}

export async function downloadUpdatePackage({ url, id, fileName, token, directory, expectedSize = 0, onProgress = () => {} }) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) throw new Error('无效的更新版本')
  if (!fileName || /[\\/:<>"|?*\x00-\x1f]/.test(fileName) || fileName.startsWith('.') || /[. ]$/.test(fileName)) throw new Error('无效的更新文件名')
  const body = new URLSearchParams({ id: String(id) })
  const response = await axios.post(url, body, { responseType: 'stream', headers: { token, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' } })
  if (String(response.headers['content-type']).includes('json')) {
    response.data.destroy()
    throw new Error('更新包不可下载，请重新检查版本或登录')
  }
  await mkdir(directory, { recursive: true })
  const folder = await mkdtemp(path.join(directory, 'update-'))
  const destination = path.join(folder, fileName)
  const total = Number(expectedSize) || Number(response.headers['content-length']) || 0
  let loaded = 0
  const progress = new Transform({ transform(chunk, encoding, callback) {
    loaded += chunk.length
    onProgress({ loaded, total, progress: total ? Math.min(99, Math.floor(loaded * 100 / total)) : 0 })
    callback(null, chunk)
  } })
  try {
    await pipeline(response.data, progress, createWriteStream(destination, { flags: 'wx' }))
    const info = await stat(destination)
    if (info.size === 0 || (total > 0 && info.size !== total)) throw new Error('更新包下载不完整，请重试')
    onProgress({ loaded: info.size, total: info.size, progress: 100 })
    return destination
  } catch (error) {
    await unlink(destination).catch(() => {})
    await rmdir(folder).catch(() => {})
    throw error
  }
}
