import { mergeChatMessage } from '../../shared/chatMessageMerge.mjs'

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
    if (type === 18) {
      const update = message.extentData
      if (!update || typeof update.contactId !== 'string' || typeof update.remark !== 'string') return
      await deps.updateContactRemark(update.contactId, update.remark)
      if (active()) deps.emit(message)
      return
    }
    if (type === 6) {
      const existing = await deps.findMessage(message.messageId)
      if (!active()) return
      if (!existing?.messageId && (!message.sessionId || !message.contactId)) return
      const completed = mergeChatMessage(existing, message)
      await deps.saveMessage(completed)
      if (!active()) return
      let sessionInfo = await deps.findSession(message.contactId)
      if (!active()) return
      if (!sessionInfo?.sessionId && completed.sessionId && completed.contactId) {
        await deps.saveSession(deps.currentSessionId(), { ...completed, lastMessage: completed.messageContent || '[文件]', lastReceiveTime: completed.sendTime }, { incrementUnread: false })
        if (!active()) return
        sessionInfo = await deps.findSession(message.contactId)
      }
      if (active()) deps.emit({ ...completed, messageType: 6, extentData: sessionInfo, duplicate: Boolean(existing?.messageId), incrementUnread: false })
      return
    }
    if (!contentTypes.has(type)) return
    const existing = await deps.findMessage(message.messageId)
    if (!active()) return
    const ai = type >= 14 && type <= 16
    const saved = mergeChatMessage(existing, { ...message, messageType: ai ? 14 : type })
    await deps.saveMessage(saved)
    if (!active()) return
    const extra = message.extentData && typeof message.extentData === 'object' ? message.extentData : {}
    const session = {
      ...saved, ...extra,
      lastMessage: saved.messageContent ?? extra.lastMessage ?? saved.lastMessage ?? '',
      lastReceiveTime: saved.sendTime ?? extra.lastReceiveTime
    }
    if (message.contactType === 1 && message.sendUserId !== deps.userId()) {
      session.lastMessage = `${message.sendUserNickName || ''}: ${session.lastMessage}`
    }
    const incrementUnread = !existing?.messageId && type !== 15 && type !== 16 && message.sendUserId !== deps.userId()
    await deps.saveSession(deps.currentSessionId(), session, { incrementUnread })
    if (!active()) return
    const sessionInfo = await deps.findSession(message.contactId)
    if (active()) deps.emit({ ...saved, messageType: type, extentData: sessionInfo, duplicate: Boolean(existing?.messageId), incrementUnread })
  }
}
