export function mediaExecutablePath(filePath) {
  if (typeof filePath !== 'string' || !filePath) throw new Error('媒体处理程序路径不可用')
  // child_process.spawn cannot execute directly inside an ASAR archive.
  return filePath.replace(/\.asar([\\/])/, '.asar.unpacked$1')
}
