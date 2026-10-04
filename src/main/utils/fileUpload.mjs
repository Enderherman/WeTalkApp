import axios from 'axios'

export async function uploadFileRequest(url, body, token) {
  const response = await axios.post(url, body, {
    headers: { ...body.getHeaders(), token },
    maxBodyLength: Infinity,
    timeout: 0
  })
  if (response.data?.code !== 200) throw new Error(response.data?.message || '文件上传失败，请重试')
  return response.data
}

export async function persistOutgoingFile({ message, save, upload, update, notify, isActive = () => true }) {
  await save({ ...message, status: 0 })
  try {
    await upload(message.messageId, message.filePath, message.fileType)
    if (!isActive()) return
    await update({ status: 1 }, { messageId: message.messageId })
    notify({ status: 1, messageId: message.messageId })
  } catch (error) {
    if (!isActive()) return
    await update({ status: 2 }, { messageId: message.messageId })
    notify({ status: 2, messageId: message.messageId, error: error.message || '文件上传失败，请重试' })
  }
}
