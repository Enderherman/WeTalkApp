import path from 'node:path'
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { MediaRequestError, resolveMediaPath, assertMediaPath } from './localMediaServer.mjs'

export async function processOutgoingMedia({ messageId, inputPath, fileType, accountId, directory, isActive, loadMessage,
  getVideoCodec, convertHevcToH264, generateThumbnail, upload }) {
  const assertActive = () => { if (!isActive()) throw new MediaRequestError(401, '账号已变更，文件处理已停止') }
  assertActive()
  const message = await loadMessage(messageId)
  assertActive()
  if (!message?.fileName || (message.userId && message.userId !== accountId)) throw new Error('无法读取当前账号的文件消息')
  const actualType = Number(message.fileType ?? fileType)
  if (![0, 1, 2].includes(actualType)) throw new Error('文件消息类型无效')
  const savePath = await resolveMediaPath({ directory, partType: 'chat', fileId: messageId, loadMessage: async () => message })
  assertActive()
  const parsed = path.parse(savePath)
  const temporary = path.join(parsed.dir, `.${parsed.name}-${randomUUID()}.upload${parsed.ext}`)
  const temporaryCover = `${temporary}_cover.png`
  const finalCover = `${savePath}_cover.png`
  let codec = null
  let converted = false
  let hasCover = false
  try {
    await fs.copyFile(inputPath, temporary)
    assertActive()
    if (actualType !== 2) {
      codec = await getVideoCodec(inputPath)
      assertActive()
      if (codec?.toLowerCase() === 'hevc') {
        await fs.rm(temporary)
        await convertHevcToH264(inputPath, temporary)
        assertActive()
        codec = 'h264'
        converted = true
      }
      if (codec) {
        await generateThumbnail(temporary, temporaryCover)
        assertActive()
        hasCover = true
      }
    }
    const size = (await fs.stat(temporary)).size
    if (!size) throw new Error('处理后的文件为空')
    assertActive()
    await assertMediaPath(directory, savePath)
    await assertMediaPath(directory, finalCover)
    assertActive()
    await fs.rename(temporary, savePath)
    assertActive()
    if (hasCover) await fs.rename(temporaryCover, finalCover)
    assertActive()
    const prepared = { messageId, fileName: message.fileName, fileSize: size, fileType: actualType,
      savePath, coverPath: hasCover ? finalCover : null, codec, converted }
    await upload(prepared)
    assertActive()
    return prepared
  } finally {
    await Promise.all([temporary, temporaryCover].map((file) => fs.rm(file, { force: true }).catch(() => {})))
  }
}
