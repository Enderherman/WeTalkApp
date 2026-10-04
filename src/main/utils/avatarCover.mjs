import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { MediaRequestError, resolveMediaPath } from './localMediaServer.mjs'

export async function createAvatarCover({ directory, inputPath, isActive, convertImage, createThumbnail }) {
  const assertActive = () => { if (!isActive()) throw new MediaRequestError(401, '账号已变更，请重新选择头像') }
  assertActive()
  const id = `avatar-${randomUUID()}`
  const avatarPath = await resolveMediaPath({ directory, partType: 'tmp', fileId: `${id}.png` })
  const coverPath = await resolveMediaPath({ directory, partType: 'tmp', fileId: `${id}_cover.png` })
  try {
    assertActive()
    await convertImage(inputPath, avatarPath)
    assertActive()
    await createThumbnail(avatarPath, coverPath)
    assertActive()
    const [avatarStream, coverStream] = await Promise.all([fs.readFile(avatarPath), fs.readFile(coverPath)])
    assertActive()
    return { avatarStream, coverStream }
  } finally {
    await Promise.all([avatarPath, coverPath].map((file) => fs.rm(file, { force: true }).catch(() => {})))
  }
}
