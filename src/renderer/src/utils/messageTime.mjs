const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
const asDate = (value) => new Date(typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value)
export function shouldShowMessageTime(message, previous) {
  if (!previous) return true
  return dayKey(asDate(message.sendTime)) !== dayKey(asDate(previous.sendTime)) || Number(message.sendTime) - Number(previous.sendTime) >= 5 * 60 * 1000
}
export function formatMessageTime(value, now = new Date()) {
  const date = asDate(value)
  if (Number.isNaN(date.getTime())) return ''
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  if (dayKey(date) === dayKey(now)) return `今天 ${time}`
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (dayKey(date) === dayKey(yesterday)) return `昨天 ${time}`
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${time}`
}
