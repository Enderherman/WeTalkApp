const MB = 1024 * 1024
export function validateChatUpload(file, fileType, limits = {}) {
  if (!String(file.name || '').trim() || file.name.length > 200) return '文件名不能为空，且不能超过 200 个字符'
  if (file.size <= 0) return '空文件无法发送'
  const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
  if (extension && !/^[a-z0-9]{1,16}$/.test(extension)) return '文件扩展名格式不受支持'
  const configured = Number(limits[fileType === 0 ? 'maxImageSize' : fileType === 1 ? 'maxVideoSize' : 'maxFileSize'])
  const fallback = fileType === 0 ? 200 : fileType === 1 ? 500 : 5000
  const configuredLimit = Number.isSafeInteger(configured) && configured > 0 ? configured : fallback
  // Reserve multipart overhead under the default 500 MB servlet request limit,
  // matching the Web client while preserving administrator-configured values.
  const hardLimit = fileType === 0 ? 200 : 499
  if (file.size > Math.min(configuredLimit, hardLimit) * MB) return `文件不能超过 ${configuredLimit <= hardLimit ? configuredLimit : fileType === 0 ? 200 : 500} MB`
  return null
}

export function validateAvatarFile(file) {
  const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' }
  const extension = String(file.name || '').split('.').pop().toLowerCase()
  if (!types[extension] || file.type !== types[extension]) return '头像和封面需使用 PNG、JPEG、GIF、BMP 或 WebP 图片'
  if (file.size <= 0 || file.size > 10 * MB) return '头像或封面不能为空，且不能超过 10 MiB'
  return null
}

export function createAvatarSelection({ state, createCover, onResult }) {
  let generation = 0
  return {
    dispose() { generation++ },
    async select(file) {
      const version = ++generation
      const error = validateAvatarFile(file)
      state.error = error || ''
      if (error) { state.loading = false; return }
      state.loading = true
      try {
        const { avatarStream, coverStream } = await createCover(file.path)
        if (version !== generation) return
        onResult({ avatarFile: new File([avatarStream], 'avatar.png', { type: 'image/png' }), coverFile: new File([coverStream], 'cover.png', { type: 'image/png' }) })
      } catch (error) { if (version === generation) state.error = error.message || '头像处理失败，请重新选择' }
      finally { if (version === generation) state.loading = false }
    }
  }
}
