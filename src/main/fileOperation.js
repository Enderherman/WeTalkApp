import { selectChatMessagesByMessageId } from './database/ChatMessageModel'

const fs = require('fs')
const fse = require('fs-extra')
const NODE_ENV = process.env.NODE_ENV
const path = require('path')
const { app, shell } = require('electron')
const FormData = require('form-data') //引入FormData模块（用于构建表单数据)
import store from './store'
import { dialog } from 'electron'
import { selectSettingInfo, updateSysSetting } from './database/UserSettingModel'
import { getWindow } from './windowProxy'
import { uploadFileRequest } from './utils/fileUpload.mjs'
import { downloadUpdatePackage } from './utils/updateDownload.mjs'
import { MediaRequestError, listenLocalMediaServer, resolveMediaPath } from './utils/localMediaServer.mjs'
import { downloadMediaToCache } from './utils/mediaDownload.mjs'
import { getDesktopRendererOrigin } from './utils/desktopRendererOrigin'
import { createAvatarCover } from './utils/avatarCover.mjs'
import { mediaExecutablePath } from './utils/mediaExecutable.mjs'
import { appendCachedUploadFile } from './utils/cachedUploadFile.mjs'
import { createMediaProcessors } from './utils/mediaProcessing.mjs'
import { processOutgoingMedia } from './utils/outgoingMedia.mjs'

// 引入 ffmpeg 相关包
const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = mediaExecutablePath(require('ffmpeg-static'))
const ffprobePath = mediaExecutablePath(require('ffprobe-static').path)

// 配置 ffmpeg 路径
ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

const { getVideoCodec, convertHevcToH264, generateThumbnail } = createMediaProcessors(ffmpeg)

const image_suffix = '.png'

/**
 * 将文件保存到本地并处理
 * @param {string} messageId - 消息ID
 * @param {string} filePath - 原始文件路径
 * @param {number} fileType - 文件类型
 * @returns {Promise<object>} 处理后文件的名称、实际大小和缓存位置
 */
const saveFileToLocal = async (messageId, filePath, fileType) => {
  const accountId = store.getUserId()
  const token = store.getUserData('token')
  const directory = store.getUserData('localFileFolder')
  const uploadUrl = `${getDomainPath()}/api/chat/uploadFile`
  return processOutgoingMedia({
    messageId, inputPath: filePath, fileType, accountId, directory,
    isActive: () => Boolean(accountId && token && store.getUserId() === accountId && store.getUserData('token') === token),
    loadMessage: selectChatMessagesByMessageId, getVideoCodec, convertHevcToH264, generateThumbnail,
    upload: (prepared) => uploadFile(messageId, prepared.savePath, prepared.coverPath, token, prepared.fileName, uploadUrl)
  })
}

/**
 * 上传文件
 */
const uploadFile = (messageId, savePath, coverPath, token, originalName, url) => {
  const formData = new FormData()
  formData.append('messageId', messageId)
  appendCachedUploadFile(formData, savePath, originalName)
  if (coverPath) {
    formData.append('cover', fs.createReadStream(coverPath))
  }
  return uploadFileRequest(url, formData, token)
}

/**
 * 获取地址
 */
const getDomainPath = () => {
  return NODE_ENV !== 'development' ? store.getData('prodDomain') : store.getData('devDomain')
}

/**
 * 获取模块路径
 */
const getResourcesPath = () => {
  return NODE_ENV === 'development' ? app.getAppPath()
    : process.resourcesPath || path.join(path.dirname(app.getPath('exe')), 'resources')
}

/**
 * 获取路径
 */
const getLocalFilePath = (partType, showCover, fileId) => resolveMediaPath({
  directory: store.getUserData('localFileFolder'), partType, showCover, fileId,
  loadMessage: selectChatMessagesByMessageId
})

/**
 * 图片服务器
 */
let server = null
let serverOperation = Promise.resolve()
const startLocalServer = (serverPort) => {
  const accountId = store.getUserId()
  const directory = store.getUserData('localFileFolder')
  const token = store.getUserData('token')
  const isActive = () => store.getUserId() === accountId && store.getUserData('token') === token
  serverOperation = serverOperation.catch(() => {}).then(async () => {
    await stopCurrentServer()
    if (!isActive()) throw new MediaRequestError(401)
    server = await listenLocalMediaServer({
      getContext: () => ({ accountId, directory, token, isActive }),
      allowedOrigins: () => {
        const origins = [getDesktopRendererOrigin()]
        if (process.env.ELECTRON_RENDERER_URL) origins.push(new URL(process.env.ELECTRON_RENDERER_URL).origin)
        return origins.filter(Boolean)
      },
      resolveFile: (query, context) => resolveMediaPath({ ...query, directory: context.directory, loadMessage: selectChatMessagesByMessageId }),
      downloadFile: (query, savePath, context) => downloadMediaToCache({
        ...query, savePath, ...context, url: `${getDomainPath()}/api/chat/downloadFile`,
        fallbackAvatarPath: path.join(getResourcesPath(), 'assets/default_avatar.png')
      })
    }, serverPort)
  })
  return serverOperation
}
const stopCurrentServer = async () => {
  const previous = server
  server = null
  if (!previous) return
  await new Promise((resolve, reject) => {
    previous.close((error) => error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : resolve())
    previous.closeAllConnections?.()
  })
}
const closeLocalServer = () => {
  serverOperation = serverOperation.catch(() => {}).then(stopCurrentServer)
  return serverOperation
}

/**
 * 创建头像的cover
 */
const createCover = (filePath) => {
  const accountId = store.getUserId()
  const directory = store.getUserData('localFileFolder')
  return createAvatarCover({
    directory, inputPath: filePath,
    isActive: () => Boolean(accountId && store.getUserId() === accountId),
    convertImage: (inputPath, outputPath) => new Promise((resolve, reject) => {
      ffmpeg(inputPath).output(outputPath).frames(1).on('end', resolve).on('error', reject).run()
    }),
    createThumbnail: generateThumbnail
  })
}

/**
 * 保存文件
 */
const saveAs = async ({ partType, fileId }) => {
  let fileName = ''
  if (partType === 'avatar') {
    fileName = fileId + image_suffix
  } else if (partType === 'chat') {
    let messageInfo = await selectChatMessagesByMessageId(fileId)
    fileName = messageInfo.fileName
  }
  const localPath = await getLocalFilePath(partType, false, fileId)
  const options = {
    title: '保存文件',
    defaultPath: fileName
  }
  let result = await dialog.showSaveDialog(null, options)
  if (result.canceled || result.filePath === '') {
    return
  }
  const filePath = result.filePath
  fs.copyFileSync(localPath, filePath)
}

/**
 * 从剪切板复制文件到内存
 */
const saveClipBoardFile = async (file) => {
  const fileSuffix = file.name.substring(file.name.lastIndexOf('.'))

  const filePath = await getLocalFilePath('tmp', false, 'temp' + fileSuffix)
  console.log('fileSuffix', fileSuffix, '\nfilePath', filePath)
  let byteArray = file.byteArray
  const buffer = Buffer.from(byteArray)
  fs.writeFileSync(filePath, buffer)
  return {
    size: byteArray.length,
    name: file.name,
    path: filePath
  }
}

/**
 * 打开文件存储目录
 */
const openLocalFolder = async () => {
  let settingInfo = await selectSettingInfo()
  const sysSetting = JSON.parse(settingInfo.sysSetting)
  const localFileFolder = sysSetting.localFileFolder
  if (!fs.existsSync(localFileFolder)) {
    fs.mkdirSync(localFileFolder, { recursive: true })
  }
  shell.openPath('file:///' + localFileFolder + store.getUserId())
}

/**
 * 更改文件保存目录
 */
const changeLocalFolder = async () => {
  let settingInfo = await selectSettingInfo()
  const sysSetting = JSON.parse(settingInfo.sysSetting)
  let localFileFolder = sysSetting.localFileFolder
  const options = {
    properties: ['openDirectory'],
    defaultPath: localFileFolder
  }
  let result = await dialog.showOpenDialog(options)
  if (result.canceled) {
    return
  }
  const newFileFolderPath = result.filePaths[0]
  if (localFileFolder !== newFileFolderPath + '\\') {
    const userId = store.getUserId()
    getWindow('main').webContents.send('copyCallback')
    await fse.copySync(localFileFolder + '/' + userId, newFileFolderPath + '/' + userId)
    sysSetting.localFileFolder = newFileFolderPath + '\\'
    const newSysSetting = JSON.stringify(sysSetting)
    await updateSysSetting(newSysSetting)
    store.setUserData('localFileFolder', sysSetting.localFileFolder + store.getUserId())
    await getWindow('main').webContents.send('getSysSettingCallback', newSysSetting)
  }
}

/**
 * 下载更新 安装更新
 */
const downloadUpdate = async (id, fileName, expectedSize, onProgress) => {
  const localFile = await downloadUpdatePackage({
    url: `${getDomainPath()}/api/app/downloadUpdate`, id, fileName, expectedSize,
    token: store.getUserData('token'), directory: path.join(app.getPath('temp'), 'wetalk-updates'), onProgress
  })
  const error = await shell.openPath(localFile)
  if (error) throw new Error(`无法启动安装程序：${error}`)
}
export {
  saveFileToLocal,
  startLocalServer,
  closeLocalServer,
  createCover,
  saveAs,
  saveClipBoardFile,
  openLocalFolder,
  changeLocalFolder,
  downloadUpdate
}
