export function validateRemark(value) {
  const remark = String(value ?? '').trim()
  if (remark.length > 40) throw new Error('备注最多 40 个字符')
  return remark
}

export function contactDisplayName(contact) {
  return contact?.remark || contact?.contactName || contact?.nickName || contact?.groupName || ''
}

export function applyContactRemark(contact, update) {
  if (!contact || !update || (contact.contactId || contact.userId) !== update.contactId) return false
  contact.remark = String(update.remark ?? '')
  return true
}
