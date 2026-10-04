export const quotaFields = ['maxGroupCount', 'maxGroupMemberCount', 'maxImageSize', 'maxVideoSize', 'maxFileSize']
export function isPositiveQuota(value) {
  const number = Number(value)
  return String(value ?? '').trim() !== '' && Number.isInteger(number) && number > 0 && number <= 2147483647
}
export function normalizeSystemSettings(value) {
  const result = { ...value }
  for (const field of quotaFields) {
    if (!isPositiveQuota(value[field])) throw new Error('群数量、成员数量及文件大小必须是正整数')
    result[field] = Number(value[field])
  }
  result.robotNickName = String(value.robotNickName || '').trim()
  result.robotWelcome = String(value.robotWelcome || '').trim()
  if (!result.robotNickName || result.robotNickName.length > 20) throw new Error('机器人昵称需为 1 至 20 个字符')
  if (!result.robotWelcome || result.robotWelcome.length > 300) throw new Error('欢迎消息需为 1 至 300 个字符')
  return result
}
