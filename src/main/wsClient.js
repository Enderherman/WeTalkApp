import WebSocket from 'ws'
import store from './store'
import { saveOrUpdateChatSessionByMessage, saveOrUpdateChatSessionUserBatch4Init, selectUserSessionByContactId, updateGroupName, updatePeerReadMessageId } from './database/ChatSessionUserModel'
import { saveMessage, saveMessageBatch, updateMessage, selectChatMessagesByMessageId } from './database/ChatMessageModel'
import { updateContactApplyNoReadCount } from './database/UserSettingModel'
import { createRealtimeClient } from './utils/realtimeClient.mjs'
import { createDesktopMessageSync } from './utils/desktopMessageSync.mjs'

let client = null
const closeWs = () => { client?.stop(); client = null }

const initWs = (config, sender) => {
  closeWs()
  const sync = createDesktopMessageSync({
    userId: () => config.userId,
    currentSessionId: () => store.getUserData('currentSessionId'),
    saveSessions: saveOrUpdateChatSessionUserBatch4Init,
    saveMessages: saveMessageBatch,
    updateApplications: updateContactApplyNoReadCount,
    updateContactName: updateGroupName,
    updateReadReceipt: updatePeerReadMessageId,
    updateMessage,
    findMessage: selectChatMessagesByMessageId,
    saveMessage,
    saveSession: saveOrUpdateChatSessionByMessage,
    findSession: selectUserSessionByContactId,
    emit: (message) => { if (!sender.isDestroyed()) sender.send('receiveMessage', message) },
    close: closeWs
  })
  client = createRealtimeClient({
    createSocket: (url) => new WebSocket(url),
    onMessage: sync,
    onError: (error) => console.error('实时连接处理失败:', error.message),
    onState: (state) => { if (!sender.isDestroyed()) sender.send('connectionState', state) }
  })
  const origin = process.env.NODE_ENV !== 'development' ? store.getData('prodWsDomain') : store.getData('devWsDomain')
  const url = new URL(origin)
  url.searchParams.set('token', config.token)
  client.start(url.toString())
}

export { initWs, closeWs }
