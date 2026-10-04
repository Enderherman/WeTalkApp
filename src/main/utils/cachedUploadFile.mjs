import path from 'node:path'
import { createReadStream } from 'node:fs'
import mime from 'mime-types'

export function appendCachedUploadFile(form, cachePath, originalName) {
  if (typeof originalName !== 'string' || !originalName || /[\r\n\0]/.test(originalName)) throw new Error('上传文件名无效')
  const filename = path.win32.basename(path.posix.basename(originalName))
  if (!filename || filename === '.' || filename === '..') throw new Error('上传文件名无效')
  // FormData otherwise checks the stream's cache path before options.filename for MIME.
  form.append('file', createReadStream(cachePath), { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
}
