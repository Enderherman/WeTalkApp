import axios from 'axios'
import FormData from 'form-data'
import { createReadStream, createWriteStream, promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { MediaRequestError, assertMediaPath } from './localMediaServer.mjs'

export async function downloadMediaToCache({ url, fileId, showCover, savePath, partType, token, directory, fallbackAvatarPath, isActive = () => true }) {
  if (!token || !isActive()) throw new MediaRequestError(401)
  await assertMediaPath(directory, savePath)
  const body = new FormData()
  body.append('fileId', fileId)
  body.append('showCover', String(showCover))
  let response
  try {
    response = await axios.post(url, body, { responseType: 'stream', headers: { ...body.getHeaders(), token }, timeout: 120_000 })
  } catch (error) {
    error.response?.data?.destroy?.()
    throw new MediaRequestError(error.response?.status === 404 ? 404 : 502)
  }
  let input = response.data
  const temporary = `${savePath}.${randomUUID()}.part`
  try {
    if (String(response.headers['content-type']).toLowerCase().includes('json')) {
      let text = ''
      for await (const chunk of input) {
        text += chunk.toString('utf8')
        if (text.length > 65536) { input.destroy(); throw new MediaRequestError(502) }
      }
      let result
      try { result = JSON.parse(text) } catch { throw new MediaRequestError(502) }
      if (result.code === 901) throw new MediaRequestError(401)
      if (partType !== 'avatar' || ![404, 600].includes(result.code) || !fallbackAvatarPath) throw new MediaRequestError(result.code === 404 ? 404 : 502)
      input = createReadStream(fallbackAvatarPath)
    }
    if (!isActive()) { input.destroy(); throw new MediaRequestError(401) }
    await pipeline(input, createWriteStream(temporary, { flags: 'wx' }))
    if (!isActive()) throw new MediaRequestError(401)
    await assertMediaPath(directory, savePath)
    await fs.rename(temporary, savePath)
  } catch (error) {
    input.destroy()
    throw error
  } finally { await fs.rm(temporary, { force: true }).catch(() => {}) }
}
