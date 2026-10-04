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

// 引入 ffmpeg 相关包
const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = mediaExecutablePath(require('ffmpeg-static'))
const ffprobePath = mediaExecutablePath(require('ffprobe-static').path)

// 配置 ffmpeg 路径
ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

const cover_image_suffix = '_cover.png'
const image_suffix = '.png'

/**
 * 将文件保存到本地并处理
 * @param {string} messageId - 消息ID
 * @param {string} filePath - 原始文件路径
 * @param {number} fileType - 文件类型
 * @returns {Promise<void>}
 */
const saveFileToLocal = async (messageId, filePath, fileType) => {
  const token = store.getUserData('token')
  try {
    // 获取保存路径
    let savePath = await getLocalFilePath('chat', false, messageId)
    savePath = path.normalize(savePath)
    let coverPath = null
    // 复制文件
    fs.copyFileSync(filePath, savePath)
    // 处理非文件类型文件
    if (fileType !== 2) {
      // 1.获取视频编码类型
      const codecInfo = await getVideoCodec(filePath)
      const codeName = codecInfo ? codecInfo.toLowerCase() : ''
      console.log('codename:', codeName)

      // 2.如果是HEVC格式，转换为H.264
      if (codeName === 'hevc') {
        console.log(filePath, '是hevc')
        // 2.1 先删除复制的文件
        fs.rmSync(savePath)
        // 2.2 转换格式
        await convertHevcToH264(filePath, savePath)
      }

      // 3.生成缩略图
      // Audio has no video stream; lack of a thumbnail must not reject it.
      if (codecInfo) {
        coverPath = savePath + cover_image_suffix
        await generateThumbnail(savePath, coverPath)
      }
    }
    // 上传文件
    await uploadFile(messageId, savePath, coverPath, token)
  } catch (error) {
    console.error('保存文件失败:', error)
    throw error
  }
}

/**
 * 获取视频编码类型
 * @param {string} filePath - 文件路径
 * @returns {Promise<string>} - 编码类型
 */
const getVideoCodec = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('获取视频编码信息失败:', err)
        reject(err)
        return
      }

      const videoStream = metadata.streams.find((stream) => stream.codec_type === 'video')
      if (videoStream) {
        resolve(videoStream.codec_name)
      } else {
        resolve(null)
      }
    })
  })
}

/**
 * 将HEVC格式转换为H.264
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputPath - 输出文件路径
 * @returns {Promise<void>}
 */
const convertHevcToH264 = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions('-c:v', 'libx264')
      .outputOptions('-crf', '20')
      .output(outputPath)
      .on('end', () => {
        console.log('视频转码完成')
        resolve()
      })
      .on('error', (err) => {
        console.error('视频转码失败:', err)
        reject(err)
      })
      .run()
  })
}

/**
 * 生成缩略图
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputPath - 输出文件路径
 * @returns {Promise<void>}
 */
const generateThumbnail = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .frames(1)
      .outputOptions([
        '-vf',
        'scale=170:-1', // 宽 170，高等比
        '-f',
        'image2' // 强制 image2 格式
      ])
      .on('end', () => {
        console.log('缩略图生成完成')
        setTimeout(() => {
          if (fs.existsSync(outputPath)) {
            console.log('缩略图文件确认存在:', outputPath)
            resolve()
          } else {
            console.error('缩略图生成失败: 文件不存在', outputPath)
            reject(new Error('缩略图文件不存在'))
          }
        }, 100)
      })
      .on('error', (err) => {
        console.error('缩略图生成失败:', err)
        reject(err)
      })
      .run()
  })
}

/**
 * 上传文件
 */
const uploadFile = (messageId, savePath, coverPath, token) => {
  const formData = new FormData()
  formData.append('messageId', messageId)
  formData.append('file', fs.createReadStream(savePath))
  if (coverPath) {
    formData.append('cover', fs.createReadStream(coverPath))
  }
  const url = `${getDomainPath()}/api/chat/uploadFile`
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
