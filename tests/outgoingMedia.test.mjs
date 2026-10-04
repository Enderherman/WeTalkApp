import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs, createReadStream } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import ffmpeg from 'fluent-ffmpeg'
import FormData from 'form-data'
import { createMediaProcessors } from '../src/main/utils/mediaProcessing.mjs'
import { processOutgoingMedia } from '../src/main/utils/outgoingMedia.mjs'
import { resolveMediaPath } from '../src/main/utils/localMediaServer.mjs'
import { appendCachedUploadFile } from '../src/main/utils/cachedUploadFile.mjs'
import { uploadFileRequest } from '../src/main/utils/fileUpload.mjs'

const localRequire = createRequire(import.meta.url)
const ffmpegPath = localRequire('ffmpeg-static')
const ffprobePath = localRequire('ffprobe-static').path
ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)
const processors = createMediaProcessors(ffmpeg, { threads: 1 })
const run = promisify(execFile)
const processOptions = { windowsHide: true, encoding: 'utf8' }
const message = { messageId: 42, userId: 'Ufirst', fileName: 'original-user-video.mp4', fileType: 1, sendTime: 1791000000000 }
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const probe = async (file) => JSON.parse((await run(ffprobePath,
  ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,pix_fmt', '-show_entries', 'format=duration,size', '-of', 'json', file], processOptions)).stdout)

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'wetalk-outgoing-media-test-'))
  t.after(async () => {
    assert(path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep + 'wetalk-outgoing-media-test-'))
    await fs.rm(root, { recursive: true, force: true })
  })
  const inputPath = path.join(root, 'source.mp4')
  await fs.writeFile(inputPath, 'original input')
  return { root, inputPath, directory: path.join(root, 'Ufirst'), second: path.join(root, 'Usecond') }
}

function multipartParts(bytes, boundary) {
  const parts = {}
  const marker = Buffer.from(`--${boundary}`)
  let position = bytes.indexOf(marker)
  while (position !== -1) {
    const start = position + marker.length + 2
    const headerEnd = bytes.indexOf(Buffer.from('\r\n\r\n'), start)
    const end = bytes.indexOf(Buffer.from(`\r\n--${boundary}`), start)
    if (headerEnd === -1 || end === -1) break
    const header = bytes.subarray(start, headerEnd).toString('utf8')
    const name = /name="([^"]+)"/.exec(header)?.[1]
    if (name) parts[name] = { name: /filename="([^"]+)"/.exec(header)?.[1],
      type: /Content-Type: ([^\r\n]+)/i.exec(header)?.[1], bytes: bytes.subarray(headerEnd + 4, end) }
    position = end + 2
  }
  return parts
}

test('the real HEVC processing pipeline produces H264, PNG cover and matching original-name HTTP metadata', async (t) => {
  const paths = await fixture(t)
  await run(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=64x48:rate=10', '-t', '1', '-an',
    '-c:v', 'libx265', '-threads', '1', '-filter_threads', '1', '-x265-params', 'pools=1:frame-threads=1:log-level=error',
    '-pix_fmt', 'yuv420p', '-tag:v', 'hvc1', paths.inputPath], processOptions)
  const originalBytes = await fs.readFile(paths.inputPath)
  const before = await probe(paths.inputPath)
  assert.equal(before.streams[0].codec_name, 'hevc')
  let received, finalMetadata
  const server = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const boundary = /boundary=(.+)$/.exec(request.headers['content-type'])[1]
    received = multipartParts(Buffer.concat(chunks), boundary)
    finalMetadata = { messageId: Number(received.messageId.bytes.toString()), fileName: received.file.name,
      fileSize: received.file.bytes.length, fileType: 1, status: 1 }
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ code: 200, data: finalMetadata }))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections?.() }))
  const prepared = await processOutgoingMedia({ ...paths, messageId: 42, fileType: 1, accountId: 'Ufirst',
    isActive: () => true, loadMessage: async () => message, ...processors,
    upload: async (result) => {
      const form = new FormData()
      form.append('messageId', 42)
      appendCachedUploadFile(form, result.savePath, result.fileName)
      form.append('cover', createReadStream(result.coverPath))
      await uploadFileRequest(`http://127.0.0.1:${server.address().port}/upload`, form, 'fixture-token')
    }
  })
  const output = await fs.readFile(prepared.savePath)
  const cover = await fs.readFile(prepared.coverPath)
  const after = await probe(prepared.savePath)
  const thumbnail = await probe(prepared.coverPath)
  assert.equal(after.streams[0].codec_name, 'h264')
  assert.equal(after.streams[0].pix_fmt, 'yuv420p')
  assert.equal(after.streams[0].width, 64)
  assert.equal(after.streams[0].height, 48)
  assert.equal(Number(after.format.duration), 1)
  assert.equal(thumbnail.streams[0].codec_name, 'png')
  assert.equal(thumbnail.streams[0].width, 170)
  assert(cover.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
  assert.equal(hash(await fs.readFile(paths.inputPath)), hash(originalBytes))
  assert.equal(prepared.converted, true)
  assert.equal(prepared.fileSize, output.length)
  assert.deepEqual(finalMetadata, { messageId: 42, fileName: message.fileName, fileSize: output.length, fileType: 1, status: 1 })
  assert.equal(received.file.type, 'video/mp4')
  assert(received.file.bytes.equals(output))
  assert.equal(received.cover.type, 'image/png')
  assert(received.cover.bytes.equals(cover))
  await run(ffmpegPath, ['-v', 'error', '-threads', '1', '-i', prepared.savePath, '-f', 'null', '-'], processOptions)
  let browserMetadata = null
  if (process.env.WETALK_PLAYWRIGHT_PACKAGE) {
    const { chromium } = localRequire(process.env.WETALK_PLAYWRIGHT_PACKAGE)
    const browser = await chromium.launch({ headless: true, channel: 'chromium' })
    try {
      const page = await browser.newPage()
      await page.setContent(`<video id="clip" preload="metadata" src="data:video/mp4;base64,${output.toString('base64')}"></video>`)
      browserMetadata = await page.evaluate(() => new Promise((resolve, reject) => {
        const video = document.getElementById('clip')
        const read = () => resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration, readyState: video.readyState })
        if (video.readyState >= 1) read()
        else { video.onloadedmetadata = read; video.onerror = () => reject(new Error('Video metadata failed')); }
      }))
      assert.equal(browserMetadata.width, 64)
      assert.equal(browserMetadata.height, 48)
      assert.equal(browserMetadata.duration, 1)
    } finally { await browser.close() }
  }
  if (process.env.WETALK_HEVC_EVIDENCE_DIR) {
    const evidence = path.resolve(process.env.WETALK_HEVC_EVIDENCE_DIR)
    await fs.mkdir(evidence, { recursive: true })
    await Promise.all([fs.copyFile(paths.inputPath, path.join(evidence, 'source-hevc.mp4')),
      fs.copyFile(prepared.savePath, path.join(evidence, 'output-h264.mp4')), fs.copyFile(prepared.coverPath, path.join(evidence, 'cover.png'))])
    await fs.writeFile(path.join(evidence, 'pipeline-result.json'), JSON.stringify({ before, after, thumbnail, finalMetadata,
      sourceSha256: hash(originalBytes), outputSha256: hash(output), coverSha256: hash(cover), browserMetadata }, null, 2))
  }
})

test('switching accounts during metadata lookup performs no cache write or upload', async (t) => {
  const paths = await fixture(t)
  let active = true, uploads = 0
  await assert.rejects(processOutgoingMedia({ ...paths, messageId: 42, fileType: 2, accountId: 'Ufirst',
    isActive: () => active, loadMessage: async () => { active = false; return { ...message, fileType: 2 } },
    upload: async () => { uploads++ } }), { status: 401 })
  assert.equal(uploads, 0)
  await assert.rejects(fs.access(paths.directory), { code: 'ENOENT' })
  await assert.rejects(fs.access(paths.second), { code: 'ENOENT' })
})

test('switching accounts during codec inspection stops conversion and cleans only the old-account staging file', async (t) => {
  const paths = await fixture(t)
  let active = true, conversions = 0, uploads = 0
  await assert.rejects(processOutgoingMedia({ ...paths, messageId: 42, fileType: 1, accountId: 'Ufirst',
    isActive: () => active, loadMessage: async () => message,
    getVideoCodec: async () => { active = false; return 'hevc' },
    convertHevcToH264: async () => { conversions++ }, upload: async () => { uploads++ } }), { status: 401 })
  assert.equal(conversions, 0)
  assert.equal(uploads, 0)
  assert.deepEqual(await fs.readdir(path.join(paths.directory, '202610')), [])
  await assert.rejects(fs.access(paths.second), { code: 'ENOENT' })
})

test('a failed transcode preserves an existing cache and removes partial output', async (t) => {
  const paths = await fixture(t)
  const target = await resolveMediaPath({ directory: paths.directory, partType: 'chat', fileId: 42, loadMessage: async () => message })
  await fs.writeFile(target, 'previous complete bytes')
  await assert.rejects(processOutgoingMedia({ ...paths, messageId: 42, fileType: 1, accountId: 'Ufirst',
    isActive: () => true, loadMessage: async () => message, getVideoCodec: async () => 'hevc',
    convertHevcToH264: async (_input, output) => { await fs.writeFile(output, 'partial'); throw new Error('transcode failed') },
    upload: async () => assert.fail('failed processing cannot upload') }), /transcode failed/)
  assert.equal(await fs.readFile(target, 'utf8'), 'previous complete bytes')
  assert.deepEqual(await fs.readdir(path.dirname(target)), ['42.mp4'])
})

test('audio without a video stream remains byte-identical and does not require a thumbnail', async (t) => {
  const paths = await fixture(t)
  paths.inputPath = path.join(paths.root, 'audio.wav')
  await run(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=8000', '-t', '0.1',
    '-c:a', 'pcm_s16le', '-threads', '1', '-filter_threads', '1', paths.inputPath], processOptions)
  const original = await fs.readFile(paths.inputPath)
  const prepared = await processOutgoingMedia({ ...paths, messageId: 42, fileType: 1, accountId: 'Ufirst',
    isActive: () => true, loadMessage: async () => ({ ...message, fileName: 'audio.wav' }), ...processors, upload: async () => {} })
  assert.equal(prepared.coverPath, null)
  assert.equal(prepared.converted, false)
  assert((await fs.readFile(prepared.savePath)).equals(original))
  assert.equal(prepared.fileSize, original.length)
})
