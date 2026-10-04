const contentTypes = new Set([1, 2, 3, 5, 8, 9, 11, 12, 14, 15, 16])

export function createDesktopMessageSync(deps) {
  return async function sync(message, active = () => true) {
    const type = Number(message.messageType)
    if (!active()) return
    if (type === 0) {
      const data = message.extentData || {}
      await deps.saveSessions(data.chatSessionList || [])
      if (!active()) return
      // INIT counts are authoritative; cache hydration is not an unread event.
      await deps.saveMessages(data.chatMessageList || [])
      if (!active()) return
      await deps.updateApplications(Number(data.applyCount) || 0, true)
      if (active()) deps.emit({ messageType: 0 })
      return
    }
    if (type === 4) {
      await deps.updateApplications(1)
      if (active()) deps.emit({ messageType: 4 })
      return
    }
    if (type === 7) { deps.emit(message); deps.close(); return }
    if (type === 10) {
      await deps.updateContactName(message.contactId, message.extentData)
      if (active()) deps.emit(message)
      return
    }
    if (type === 17) {
      await deps.updateReadReceipt(message)
      if (active()) deps.emit(message)
      return
    }
    if (type === 6) {
      await deps.updateMessage({ status: message.status }, { messageId: message.messageId })
      if (active()) deps.emit(message)
      return
    }
    if (!contentTypes.has(type)) return
    const existing = await deps.findMessage(message.messageId)
    if (!active()) return
    const ai = type >= 14 && type <= 16
    await deps.saveMessage({ ...existing, ...message, messageType: ai ? 14 : type })
    if (!active()) return
    const extra = message.extentData && typeof message.extentData === 'object' ? message.extentData : {}
    const session = {
      ...message, ...extra,
      lastMessage: message.messageContent ?? extra.lastMessage ?? message.lastMessage ?? '',
      lastReceiveTime: message.sendTime ?? extra.lastReceiveTime
    }
    if (message.contactType === 1 && message.sendUserId !== deps.userId()) {
      session.lastMessage = `${message.sendUserNickName || ''}: ${session.lastMessage}`
    }
    const incrementUnread = !existing?.messageId && type !== 15 && type !== 16 && message.sendUserId !== deps.userId()
    await deps.saveSession(deps.currentSessionId(), session, { incrementUnread })
    if (!active()) return
    const sessionInfo = await deps.findSession(message.contactId)
    if (active()) deps.emit({ ...message, extentData: sessionInfo, duplicate: Boolean(existing?.messageId), incrementUnread })
  }
}
