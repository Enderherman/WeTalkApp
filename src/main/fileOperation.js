import { selectChatMessagesByMessageId } from './database/ChatMessageModel'

const fs = require('fs')
const fse = require('fs-extra')
const NODE_ENV = process.env.NODE_ENV
const path = require('path')
const { app, shell } = require('electron')
const { exec } = require('child_process')
const FormData = require('form-data') //引入FormData模块（用于构建表单数据)
const axios = require('axios') // 引入axios库
import store from './store'
import { dialog } from 'electron'
import { selectSettingInfo, updateSysSetting } from './database/UserSettingModel'
import { getWindow } from './windowProxy'
import { uploadFileRequest } from './utils/fileUpload.mjs'

// 引入 ffmpeg 相关包
const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('ffmpeg-static')
const ffprobePath = require('ffprobe-static').path

// 配置 ffmpeg 路径
ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

const moment = require('moment')
moment.locale(' zh-cn', {})

//express 服务器
const express = require('express')
const expressServer = express()

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
 * 执行命令
 */
const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout) => {
      if (error) {
        reject(error)
      } else {
        resolve(stdout)
      }
    })
  })
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
  let resourcePath = app.getAppPath()
  if (NODE_ENV !== 'development') {
    resourcePath = path.dirname(app.getPath('exe') + '/resources')
  }
  return resourcePath
}

/**
 * 获取路径
 */
const getLocalFilePath = (partType, showCover, fileId) => {
  return new Promise((resolve) => {
    let localFolder = store.getUserData('localFileFolder')
    let localPath = null
    if (partType === 'avatar') {
      localFolder = localFolder + '/avatar/'
      if (!fs.existsSync(localFolder)) {
        fs.mkdirSync(localFolder, { recursive: true })
      }
      localPath = localFolder + fileId + image_suffix
    } else if (partType === 'chat') {
      selectChatMessagesByMessageId(fileId).then((messageInfo) => {
        const month = moment(Number.parseInt(messageInfo.sendTime)).format('YYYYMM')
        localFolder = localFolder + '/' + month
        if (!fs.existsSync(localFolder)) {
          //递归创建目录
          fs.mkdirSync(localFolder, { recursive: true })
        }
        let fileSuffix = messageInfo.fileName
        fileSuffix = fileSuffix.substring(fileSuffix.lastIndexOf('.'))
        localPath = localFolder + '/' + fileId + fileSuffix
        if (showCover) {
          localPath = localPath + cover_image_suffix
        }
        resolve(localPath)
      })
      return
    } else if (partType === 'tmp') {
      localFolder = localFolder + '/temp/'
      if (!fs.existsSync(localFolder)) {
        fs.mkdirSync(localFolder, { recursive: true })
      }
      localPath = localFolder + fileId
    }
    if (showCover) {
      localPath = localPath + cover_image_suffix
    }
    console.log('localPath: ', localPath)
    resolve(localPath)
  })
}

/**
 * 图片服务器
 */
let server = null
const startLocalServer = (serverPort) => {
  server = expressServer.listen(serverPort, () => {
    console.log('本地服务server start 在 localhost:' + serverPort)
  })
}
const closeLocalServer = () => {
  if (server) {
    server.close()
  }
}
const FILE_TYPE_CONTENT_TYPE = {
  0: 'image/',
  1: 'video/',
  2: 'application/octet-stream'
}
/**
 * get方法从端口
 */
//TODO sendP5
expressServer.get('/file', async (req, res) => {
  let { partType, fileType, fileId, showCover, forceGet } = req.query
  if (!partType || !fileId) {
    res.send('请求参数错误')
  }
  if (showCover === 'false') {
    showCover = false
  } else {
    showCover = showCover === undefined ? false : Boolean(showCover)
  }
  const localPath = await getLocalFilePath(partType, showCover, fileId)
  if (!fs.existsSync(localPath) || forceGet === 'true') {
    if (forceGet === 'true' && partType === 'avatar') {
      await downloadFile(fileId, true, localPath + cover_image_suffix, partType)
    }
    await downloadFile(fileId, showCover, localPath, partType)
  }
  const fileSuffix = localPath.substring(localPath.lastIndexOf('.') + 1)
  let contentType = FILE_TYPE_CONTENT_TYPE[fileType] + fileSuffix
  res.setHeader('Content-Type', contentType)
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (showCover || fileType !== '1') {
    fs.createReadStream(localPath).pipe(res)
    return
  }
  let stat = fs.statSync(localPath)
  let fileSize = stat.size
  let range = req.headers.range
  console.log(range, 'range')
  if (range) {
    let parts = range.replace(/bytes=/, '').split('-')
    let start = parseInt(parts[0], 10)
    let end = parts[1] ? parseInt(parts[1], 10) : start + 999999
    end = end > fileSize - 1 ? fileSize - 1 : end
    let chunkSize = end - start + 1
    let stream = fs.createReadStream(localPath, { start, end })
    let head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4'
    }
    res.writeHead(206, head)
    stream.pipe(res)
  } else {
    let head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4'
    }
    res.writeHead(200, head)
    fs.createReadStream(localPath).pipe(res)
  }
})

//TODO 从服务器下载文件
const downloadFile = (fileId, showCover, savePath, partType) => {
  showCover = showCover + ''
  let url = getDomainPath() + '/api/chat/downloadFile'
  const token = store.getUserData('token')
  return new Promise((resolve, reject) => {
    let formData = new FormData()
    formData.append('fileId', fileId)
    formData.append('showCover', showCover)
    const config = {
      responseType: 'stream',
      headers: {
        'Content-Type': 'multipart/form-data',
        token: token
      }
    }
    axios
      .post(url, formData, config)
      .then((response) => {
        const folderPath = savePath.substring(0, savePath.lastIndexOf('/'))
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true })
        }
        const stream = fs.createWriteStream(savePath)
        console.log('我在响应中---------------\n', response.headers)
        if (response.headers['content-type'] === 'application/json') {
          let resourcePath = getResourcesPath()
          console.log('我从本地取了')
          if (partType === 'avatar') {
            fs.createReadStream(resourcePath + '/assets/default_avatar.png').pipe(stream)
          } else {
            fs.createReadStream(resourcePath + '/assets/404.png').pipe(stream)
          }
        } else {
          response.data.pipe(stream)
        }
        stream.on('finish', () => {
          stream.close()
          resolve()
        })
        stream.on('error', (err) => {
          console.log('牛处问ti1le')
          stream.close()
          reject(err)
        })
      })
      .catch((err) => {
        reject(err)
      })
  })
}

/**
 * 创建头像的cover
 */
const createCover = (filePath) => {
  return new Promise((resolve, reject) => {
    let avatarId = store.getUserId() + '_temp'
    let coverId = store.getUserId() + '_temp_cover'

    getLocalFilePath('avatar', false, avatarId).then((avatarPath) => {
      fs.mkdirSync(path.dirname(avatarPath), { recursive: true })

      ffmpeg(filePath)
        .output(avatarPath)
        .on('end', async () => {
          try {
            const coverPath = await getLocalFilePath('avatar', false, coverId)
            await generateThumbnail(filePath, coverPath)
            resolve({
              avatarStream: fs.readFileSync(avatarPath),
              coverStream: fs.readFileSync(coverPath)
            })
          } catch (err) {
            console.error('createCover 缩略图生成失败:', err)
            reject(err)
          }
        })
        .on('error', (err) => {
          console.error('createCover 原始头像生成失败:', err)
          reject(err)
        })
        .run()
    })
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
const downloadUpdate = async (id, fileName) => {
  let url = `${store.getData('prodDomain')}/api/app/downloadUpdate`
  const token = store.getUserData('token')
  const params = new URLSearchParams()
  params.set('id', String(id))
  const config = {
    responseType: 'stream',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      token: token
    },
    onDownloadProgress(progress) {
      const loaded = progress.loaded
      getWindow('main').webContents.send('downloadUpdateCallback', loaded)
    }
  }
  const response = await axios.post(url, params, config)
  const localFile = await getLocalFilePath(null, false, fileName)
  const stream = fs.createWriteStream(localFile)
  response.data.pipe(stream)
  stream.on('finish', async () => {
    stream.close()
    const command = `"${localFile}"`
    execCommand(command)
  })
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
