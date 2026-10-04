import { promises as fs } from 'node:fs'
import path from 'node:path'

export function createMediaProcessors(ffmpeg, { threads = 1 } = {}) {
  const run = (command) => new Promise((resolve, reject) => command.on('end', resolve).on('error', reject).run())
  return {
    getVideoCodec: (filePath) => new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (error, metadata) => {
        if (error) { reject(error); return }
        const stream = metadata?.streams?.find((item) => item.codec_type === 'video')
        resolve(stream?.codec_name || null)
      })
    }),
    convertHevcToH264: async (inputPath, outputPath) => {
      const command = ffmpeg(inputPath)
        .inputOptions('-threads', String(threads))
        .outputOptions('-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-threads', String(threads), '-filter_threads', '1')
      if (['.mp4', '.mov'].includes(path.extname(outputPath).toLowerCase())) command.outputOptions('-movflags', '+faststart')
      await run(command.output(outputPath))
    },
    generateThumbnail: async (inputPath, outputPath) => {
      await run(ffmpeg(inputPath).inputOptions('-threads', String(threads)).output(outputPath).frames(1)
        .outputOptions('-vf', 'scale=170:-1', '-f', 'image2', '-threads', String(threads), '-filter_threads', '1'))
      if (!(await fs.stat(outputPath)).size) throw new Error('缩略图文件为空')
    }
  }
}
