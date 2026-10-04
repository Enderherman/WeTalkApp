import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { createAvatarCover } from '../src/main/utils/avatarCover.mjs'
import { mediaExecutablePath } from '../src/main/utils/mediaExecutable.mjs'

test('packaged ffmpeg and ffprobe resolve outside the ASAR on Windows and Unix', () => {
  assert.equal(mediaExecutablePath('C:\\App\\resources\\app.asar\\node_modules\\ffmpeg-static\\ffmpeg.exe'),
    'C:\\App\\resources\\app.asar.unpacked\\node_modules\\ffmpeg-static\\ffmpeg.exe')
  assert.equal(mediaExecutablePath('/Applications/WeTalk/resources/app.asar/node_modules/ffprobe-static/bin/ffprobe'),
    '/Applications/WeTalk/resources/app.asar.unpacked/node_modules/ffprobe-static/bin/ffprobe')
  assert.equal(mediaExecutablePath('D:\\source\\ffmpeg.exe'), 'D:\\source\\ffmpeg.exe')
})

async function temporary(t) {
  const directory = await fs.mkdtemp(path.join(tmpdir(), 'wetalk-avatar-test-'))
  t.after(async () => {
    assert(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep + 'wetalk-avatar-test-'))
    await fs.rm(directory, { recursive: true, force: true })
  })
  return directory
}

test('concurrent avatar requests use separate PNG paths and return only their own images', async (t) => {
  const directory = await temporary(t)
  const outputs = []
  let ready = 0, release
  const together = new Promise((resolve) => { release = resolve })
  const convertImage = async (input, output) => {
    outputs.push(output)
    await fs.writeFile(output, input)
    if (++ready === 2) release()
    await together
  }
  const createThumbnail = async (input, output) => fs.writeFile(output, `cover:${await fs.readFile(input, 'utf8')}`)
  const [one, two] = await Promise.all(['one', 'two'].map((inputPath) => createAvatarCover({ directory, inputPath, isActive: () => true, convertImage, createThumbnail })))
  assert.notEqual(outputs[0], outputs[1])
  assert.equal(one.avatarStream.toString(), 'one')
  assert.equal(one.coverStream.toString(), 'cover:one')
  assert.equal(two.avatarStream.toString(), 'two')
  assert.equal(two.coverStream.toString(), 'cover:two')
  assert.deepEqual(await fs.readdir(path.join(directory, 'temp')), [])
})

test('account changes stop later conversion stages and clean only the captured account files', async (t) => {
  const directory = await temporary(t)
  let active = true, thumbnails = 0
  await assert.rejects(createAvatarCover({
    directory, inputPath: 'input', isActive: () => active,
    convertImage: async (_input, output) => { await fs.writeFile(output, 'partial'); active = false },
    createThumbnail: async () => { thumbnails++ }
  }), { status: 401 })
  assert.equal(thumbnails, 0)
  assert.deepEqual(await fs.readdir(path.join(directory, 'temp')), [])
})

test('failed thumbnail generation rejects and removes both temporary images', async (t) => {
  const directory = await temporary(t)
  await assert.rejects(createAvatarCover({
    directory, inputPath: 'input', isActive: () => true,
    convertImage: async (_input, output) => fs.writeFile(output, 'png'),
    createThumbnail: async (_input, output) => { await fs.writeFile(output, 'partial'); throw new Error('thumbnail failed') }
  }), /thumbnail failed/)
  assert.deepEqual(await fs.readdir(path.join(directory, 'temp')), [])
})

test('the installed ffmpeg converts a real PNG and thumbnail through the isolated file pipeline', async (t) => {
  const ffmpeg = createRequire(import.meta.url)('ffmpeg-static')
  try { await fs.access(ffmpeg) } catch { t.skip('ffmpeg-static binary is not installed'); return }
  const directory = await temporary(t)
  const inputPath = path.join(directory, 'source.png')
  await fs.writeFile(inputPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV5sAAAAASUVORK5CYII=', 'base64'))
  const run = promisify(execFile)
  const result = await createAvatarCover({ directory, inputPath, isActive: () => true,
    convertImage: async (input, output) => run(ffmpeg, ['-y', '-i', input, '-frames:v', '1', output], { windowsHide: true }),
    createThumbnail: async (input, output) => run(ffmpeg, ['-y', '-i', input, '-frames:v', '1', '-vf', 'scale=170:-1', output], { windowsHide: true })
  })
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  assert(result.avatarStream.subarray(0, 8).equals(pngSignature))
  assert(result.coverStream.subarray(0, 8).equals(pngSignature))
  assert.deepEqual(await fs.readdir(path.join(directory, 'temp')), [])
})
