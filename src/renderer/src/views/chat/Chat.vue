<template>
  <Layout>
    <template #left-content>
      <!--1.拖拽框-->
      <div class="drag-panel drag"></div>
      <!--2.搜索框-->
      <div class="top-search">
        <button type="button" title="搜索聊天记录" aria-label="搜索聊天记录" @click="historySearchOpen = true">记录</button>
        <button type="button" @click="showHiddenSessions">已移除</button>
        <el-input v-model="searchKey" clearable placeholder="搜索" size="small" @keyup="search">
          <template #suffix>
            <span class="iconfont icon-search"></span>
          </template>
        </el-input>
      </div>
      <div v-if="!searchKey" class="chat-session-list">
        <template v-for="chatSession in chatSessionList" :key="chatSession.contactId">
          <ChatSession
            :data="chatSession"
            :current-session="currentChatSession.contactId === chatSession.contactId"
            @contextmenu.stop="onContextMenu(chatSession, $event)"
            @click="chatSessionClickHandler(chatSession)"
          ></ChatSession>
        </template>
      </div>
      <div v-show="searchKey" class="session-list">
        <SearchResult
          v-for="item in searchList"
          :key="item.contactId"
          :data="item"
          @click="searchClickHandler(item)"
        ></SearchResult>
      </div>
    </template>
    <template #right-content>
      <div v-if="Object.keys(currentChatSession).length > 0" class="title-panel drag">
        <div class="title">
          <span :title="currentChatSession.contactName">{{ currentChatSession.remark || currentChatSession.contactName }}</span>
          <span v-if="currentChatSession.contactType === 1"
            >({{ currentChatSession.memberCount }})</span
          >
        </div>
      </div>
      <span
        v-if="currentChatSession.contactType === 1"
        class="iconfont icon-more no-drag"
        @click="showGroupDetail"
      ></span>
      <div v-show="Object.keys(currentChatSession).length > 0" class="chat-panel">
        <div v-if="connectionState !== 'connected'" class="connection-status" role="status">
          {{ connectionState === 'failed' ? '连接恢复失败' : '正在恢复实时连接' }}，文字消息会保存到待发队列。
          <button v-if="connectionState === 'failed'" type="button" @click="retryConnection">重新连接</button>
        </div>
        <!--信息框-->
        <div id="message-panel" class="message-panel">
          <div class="history-controls">
            <button v-if="historyState.hasMore" type="button" :disabled="historyState.loading" @click="loadChatMessage">{{ historyState.loading ? '正在加载历史…' : '加载更早消息' }}</button>
            <span v-else>已到最早消息</span>
            <p v-if="historyState.error" role="alert">{{ historyState.error }}</p>
          </div>
          <div
            v-for="(data, index) in messageList"
            :key="'message' + data.messageId"
            :id="'message' + data.messageId"
            class="message-item"
            :class="{ 'history-match': data.messageId === historyMatchId }"
          >
            <!--展示时间-->
            <template
              v-if="
                index > 1 &&
                data.sendTime - messageList[index - 1].sendTime >= 300000 &&
                (data.messageType === 2 || data.messageType === 5)
              "
            >
              <ChatMessageTime :data="data" />
            </template>
            <!--系统消息-->
            <template
              v-if="
                data.messageType === 1 ||
                data.messageType === 3 ||
                data.messageType === 8 ||
                data.messageType === 9 ||
                data.messageType === 11 ||
                data.messageType === 12
              "
            >
              <ChatMessageSysMsg :data="data"></ChatMessageSysMsg>
            </template>
            <template
              v-if="
                data.messageType === 1 ||
                data.messageType === 2 ||
                data.messageType === 5 ||
                data.messageType === 14
              "
            >
              <ChatMessage
                :data="data"
                :current-chat-session="currentChatSession"
                :ai-stopping="aiState.stoppingId === data.messageId"
                :ai-error="aiState.errors[data.messageId]"
                @show-media-detail="showMediaDetailHandler"
                @retry-message="retryFileMessage"
                @stop-ai="stopAiMessage"
              ></ChatMessage>
            </template>
          </div>
          <div v-for="draft in outboxState.items.filter((item) => item.contactId === currentChatSession.contactId)" :key="draft.clientMessageId" class="pending-message">
            <div>{{ draft.messageContent }}</div>
            <small>{{ draft.status === 'sending' ? '正在发送…' : draft.status === 'failed' ? draft.error : '等待联网发送' }}</small>
            <button v-if="draft.status === 'failed'" type="button" @click="outbox.retry(draft.clientMessageId)">重试</button>
            <button v-if="draft.status !== 'sending'" type="button" @click="outbox.discard(draft.clientMessageId)">取消发送</button>
          </div>
          <p v-if="outboxState.error" role="alert">{{ outboxState.error }}</p>
        </div>
        <!--输入框-->
        <MessageSend
          :current-chat-session="currentChatSession"
          :queue-text="queueTextMessage"
          @send-message4-local="sendMessage4LocalHandler"
        ></MessageSend>
      </div>
      <div v-show="Object.keys(currentChatSession).length === 0" class="chat-blank">
        <Blank></Blank>
      </div>
    </template>
  </Layout>
  <ChatGroupDetail
    ref="chatGroupDetailRef"
    @delete-chat-session-callback="deleteChatSession"
  ></ChatGroupDetail>
  <el-dialog v-model="historySearchOpen" title="搜索聊天记录" width="640px" @closed="closeHistorySearch">
    <div class="history-search-form">
      <el-select v-model="historySearchScope" aria-label="搜索范围">
        <el-option label="当前会话" value="current" :disabled="!currentChatSession.contactId" />
        <el-option label="全部会话" value="all" />
      </el-select>
      <el-input v-model="historySearchKeyword" maxlength="100" aria-label="历史消息关键词" placeholder="搜索完整聊天历史" @keydown.enter="runHistorySearch" />
      <el-button :loading="historySearchState.loading" @click="runHistorySearch">搜索</el-button>
      <el-button v-if="historySearchState.loading" @click="historySearch.cancel">停止</el-button>
    </div>
    <p aria-live="polite">已检索 {{ historySearchState.scanned }} 条，找到 {{ historySearchState.results.length }} 条</p>
    <p v-if="historySearchState.error" role="alert">{{ historySearchState.error }}</p>
    <p v-if="locatingHistory" role="status">正在加载并定位消息…</p>
    <ul class="history-search-results">
      <li v-for="message in historySearchState.results" :key="message.sessionId + ':' + message.messageId">
        <button type="button" :disabled="locatingHistory" @click="jumpToHistoryMessage(message)">
          <strong>{{ message.sourceContactName }}</strong>
          <small>{{ new Date(Number(message.sendTime)).toLocaleString('zh-CN') }}</small>
          <span><span v-for="(part, index) in highlightText(message.searchText, historySearchKeyword)" :key="index" :class="{ highlight: part.match }">{{ part.text }}</span></span>
        </button>
      </li>
    </ul>
  </el-dialog>
  <el-dialog v-model="hiddenSessionsOpen" title="已移除的会话" width="500px">
    <p>移除会话只影响本机列表，聊天记录仍然保留；新消息会让会话重新显示。</p>
    <p v-if="hiddenSessionsLoading">正在读取…</p>
    <p v-else-if="!hiddenSessions.length">没有已移除的会话</p>
    <ul class="hidden-session-list">
      <li v-for="session in hiddenSessions" :key="session.contactId">
        <span>{{ contactDisplayName(session) }}</span>
        <el-button @click="restoreHiddenSession(session)">恢复会话</el-button>
      </li>
    </ul>
  </el-dialog>
</template>

<script>
export default {
  name: 'chat'
}
</script>
<script setup>
import ChatMessageTime from '@/views/chat/ChatMessageTime.vue'
import ChatMessage from '@/views/chat/ChatMessage.vue'
import ChatSession from '@/views/chat/ChatSession.vue'
import MessageSend from '@/views/chat/MessageSend.vue'
import { nextTick, onMounted, onUnmounted, onActivated, onDeactivated, reactive, ref, watch } from 'vue'
import ContextMenu from '@imengyu/vue3-context-menu'
import '@imengyu/vue3-context-menu/lib/vue3-context-menu.css'
import Confirm from '@/utils/Confirm'
import Blank from '@/components/Blank.vue'
import ChatMessageSysMsg from '@/views/chat/ChatMessageSysMsg.vue'
import ChatGroupDetail from '@/views/chat/ChatGroupDetail.vue'
//消息数
import { useMessageCountStore } from '@/stores/MessageCountStore'
import { useRoute } from 'vue-router'
import SearchResult from '@/views/chat/SearchResult.vue'
import { messageText, highlightText } from '@/utils/messageText.mjs'
import { applyContactRemark, contactDisplayName } from '@/utils/contactRemark.mjs'
import Request from '@/utils/Request'
import Api from '@/utils/Api'
import { createHistoryPager, mergeHistoryMessages } from '@/utils/historyPaging.mjs'
import { useUserInfoStore } from '@/stores/UserInfoStore'
import { createReadCursorWriter, canMarkVisibleSession } from '@/utils/readCursor.mjs'
import { createAiStopper } from '@/utils/aiMessages.mjs'
import { createTextOutbox } from '@/utils/textOutbox.mjs'
import Message from '@/plugin/Message'
import { createHistorySearch } from '@/utils/historySearch.mjs'

const route = useRoute()
const userInfoStore = useUserInfoStore()
const messageCountStore = useMessageCountStore()

const chatSessionList = ref([])

/**
 * 初始化会话消息的请求
 */
const loadChatSession = () => {
  window.ipcRenderer.send('loadChatSession')
}

/**
 * 会话排序
 */
const sortChatSession = (dataList) => {
  dataList.sort((a, b) => {
    const topTypeResult = b['topType'] - a['topType']
    if (topTypeResult === 0) {
      return b['lastReceiveTime'] - a['lastReceiveTime']
    }
    return topTypeResult
  })
}

/**
 * 删除会话
 */
const deleteChatSessionFromList = (contactId) => {
  setTimeout(() => {
    chatSessionList.value = chatSessionList.value.filter((item) => {
      return item.contactId !== contactId
    })
    messageCountStore.setCount('chatCount', chatSessionList.value.reduce((count, item) => count + (item.noReadCount || 0), 0), true)
  }, 100)
}
//是否滚动到底部
let distanceToBottom = 0
//当前选中会话
const currentChatSession = ref({})
//消息列表
const messageList = ref([])
const hiddenSessionsOpen = ref(false)
const hiddenSessionsLoading = ref(false)
const hiddenSessions = ref([])
const showHiddenSessions = async () => {
  hiddenSessionsOpen.value = true
  hiddenSessionsLoading.value = true
  try { hiddenSessions.value = await window.ipcRenderer.invoke('loadHiddenChatSessions') }
  catch { Message.error('无法读取已移除会话，请重试') }
  finally { hiddenSessionsLoading.value = false }
}
const restoreHiddenSession = (session) => {
  window.ipcRenderer.send('reloadChatSession', { contactId: session.contactId })
  hiddenSessionsOpen.value = false
}
const historySearchOpen = ref(false)
const historySearchScope = ref('all')
const historySearchKeyword = ref('')
const historyMatchId = ref(null)
const locatingHistory = ref(false)
let historyLocationGeneration = 0
const historySearchState = reactive({ results: [], loading: false, scanned: 0, error: '' })
const historySearch = createHistorySearch({
  state: historySearchState,
  fetchPage: async (contactId, beforeMessageId, pageSize) => {
    const result = await Request({ url: Api.loadHistory, params: { contactId, beforeMessageId: beforeMessageId ?? '', pageSize }, showLoading: false, showError: false })
    return result?.data
  }
})
const runHistorySearch = () => historySearch.run(historySearchScope.value === 'current' ? [currentChatSession.value].filter((item) => item.contactId) : chatSessionList.value, historySearchKeyword.value)
const closeHistorySearch = () => { historySearch.cancel(); historyLocationGeneration++; locatingHistory.value = false }
const jumpToHistoryMessage = async (message) => {
  const session = chatSessionList.value.find((item) => item.contactId === message.sourceContactId)
  if (!session || locatingHistory.value) return
  locatingHistory.value = true
  const version = ++historyLocationGeneration
  historySearch.cancel()
  try {
    await chatSessionClickHandler(session)
    while (version === historyLocationGeneration && currentChatSession.value.contactId === session.contactId && !messageList.value.some((item) => item.messageId === message.messageId) && historyState.hasMore && !historyState.error) {
      await loadChatMessage()
    }
    if (version !== historyLocationGeneration || currentChatSession.value.contactId !== session.contactId) return
    if (!messageList.value.some((item) => item.messageId === message.messageId)) { historySearchState.error = '无法定位该消息，请重新搜索'; return }
    historyMatchId.value = message.messageId
    historySearchOpen.value = false
    await nextTick()
    document.getElementById('message' + message.messageId)?.scrollIntoView({ block: 'center' })
  } finally { if (version === historyLocationGeneration) locatingHistory.value = false }
}
const outboxState = reactive({ items: [], online: true, ready: false, error: '' })
const connectionState = ref('connecting')
const outboxUserId = userInfoStore.getInfo().userId
const outbox = createTextOutbox({
  state: outboxState,
  storage: {
    load: () => window.ipcRenderer.invoke('textOutbox:load', { userId: outboxUserId }),
    put: (draft) => window.ipcRenderer.invoke('textOutbox:save', { userId: outboxUserId, draft: { ...draft } }),
    remove: (clientMessageId) => window.ipcRenderer.invoke('textOutbox:remove', { userId: outboxUserId, clientMessageId })
  },
  send: async (draft) => {
    let failure
    const result = await Request({ url: Api.sendMessage, params: { contactId: draft.contactId, messageContent: draft.messageContent, messageType: 2, clientMessageId: draft.clientMessageId }, showLoading: false, showError: false, errorCallback: (error) => { failure = error.message } })
    if (!result) {
      const error = new Error(failure || '消息发送失败，请检查连接后重试')
      error.retryable = !failure
      throw error
    }
    return result.data
  },
  onSent: async (message, draft) => {
    const saved = { ...message, contactId: draft.contactId, sessionId: draft.sessionId }
    window.ipcRenderer.send('addChatMessage', saved)
    sendMessage4LocalHandler(saved)
  }
})
let outboxReady = Promise.resolve()
const queueTextMessage = async (messageContent) => {
  const { contactId, sessionId } = currentChatSession.value
  try {
    await outboxReady
    if (!outboxState.ready) throw new Error('待发消息缓存不可用，请重新登录后重试')
    await outbox.enqueue({ contactId, sessionId, messageContent })
    return true
  }
  catch (error) { Message.error(error.message || '无法保存待发消息，请重试'); return false }
}
const onConnectionState = (event, state) => {
  connectionState.value = state
  void outbox.setOnline(state === 'connected')
  if (state === 'reconnecting' || state === 'failed') void Request({ url: Api.getUserInfo, showLoading: false, showError: false })
}
const retryConnection = () => window.ipcRenderer.send('retryConnection')
let chatDisposed = false
const aiState = reactive({ stoppingId: null, errors: {} })
const stopAiMessage = createAiStopper({
  request: Request, state: aiState,
  isActive: () => !chatDisposed,
  onMessage: async (message) => {
    receiveAiStreamMessage(message)
    await window.ipcRenderer.invoke('cacheChatHistory', { userId: userInfoStore.getInfo().userId, messages: [{ ...message, messageType: 14 }] })
  }
})
let chatActive = true
const readWriter = createReadCursorWriter({
  send: async (contactId, messageId) => Boolean(await Request({ url: Api.markRead, params: { contactId, messageId }, showLoading: false, showError: false })),
  onConfirmed: async (contactId, messageId) => {
    await window.ipcRenderer.invoke('saveReadCursor', { userId: userInfoStore.getInfo().userId, contactId, messageId })
    const session = chatSessionList.value.find((item) => item.contactId === contactId)
    if (session) { session.lastReadMessageId = Math.max(session.lastReadMessageId || 0, messageId); session.noReadCount = 0 }
    messageCountStore.setCount('chatCount', chatSessionList.value.reduce((count, item) => count + (item.noReadCount || 0), 0), true)
  }
})
const markVisibleMessagesRead = () => {
  if (!canMarkVisibleSession({ active: chatActive, visible: document.visibilityState !== 'hidden', focused: document.hasFocus(), contactId: currentChatSession.value.contactId })) return
  const latest = messageList.value.reduce((id, message) => Math.max(id, Number(message.messageId) || 0), 0)
  void readWriter.mark(currentChatSession.value.contactId, latest)
}
const syncVisibleSession = () => {
  const visible = canMarkVisibleSession({ active: chatActive, visible: document.visibilityState !== 'hidden', focused: document.hasFocus(), contactId: currentChatSession.value.contactId })
  setSessionSelect(visible ? currentChatSession.value : {})
  if (visible) { markVisibleMessagesRead(); void readWriter.retry() }
}
const historyState = reactive({ contactId: null, loading: false, hasMore: true, error: '', loaded: false, cursor: null })
const historyPager = createHistoryPager({
  state: historyState,
  fetchPage: async (contactId, beforeMessageId, pageSize) => {
    const result = await Request({ url: Api.loadHistory, params: { contactId, beforeMessageId: beforeMessageId ?? '', pageSize }, showLoading: false, showError: false })
    return result?.data
  },
  onPage: async (messages, { contactId, append, isCurrent }) => {
    const firstId = messageList.value[0]?.messageId
    const sessionId = currentChatSession.value.sessionId
    const cached = await window.ipcRenderer.invoke('cacheChatHistory', { userId: userInfoStore.getInfo().userId, messages })
    if (!cached || !isCurrent() || currentChatSession.value.contactId !== contactId || currentChatSession.value.sessionId !== sessionId) return
    messageList.value = mergeHistoryMessages(messageList.value, messages)
    markVisibleMessagesRead()
    if (!append) scrollToBottom()
    else if (firstId) nextTick(() => document.getElementById('message' + firstId)?.scrollIntoView())
  },
  onFailure: () => loadLocalChatMessage()
})
//消息分页信息
const messagePageInfo = {
  totalPage: 0,
  pageNo: 0,
  //游标分页
  maxMessageId: null,
  noData: false
}
/**
 * 会话点击处理
 */
const chatSessionClickHandler = (item) => {
  historyMatchId.value = null
  distanceToBottom = 0
  // 在点击时重置forceGet状态，触发头像更新
  // if (item.contactId) {
  //   // 假设avatarInfoStore是全局可用的
  //   avatarInfoStore.setForceReload(item.contactId, true)
  //
  //   // 设置一个短暂的延时，稍后将forceGet重置回false
  //   setTimeout(() => {
  //     avatarInfoStore.setForceReload(item.contactId, false)
  //   }, 50)
  // }
  currentChatSession.value = Object.assign({}, item)
  //清空消息记录数
  messageCountStore.setCount('chatCount', -item.noReadCount, false)
  item.noReadCount = 0
  //获取数据
  messageList.value = []
  // 重置分页信息
  messagePageInfo.pageNo = 0
  messagePageInfo.totalPage = 1
  messagePageInfo.maxMessageId = null
  messagePageInfo.noData = false
  historyPager.reset(item.contactId)

  // console.log('点击聊天会话', item)
  const loadingHistory = loadChatMessage()
  //设置选中session
  setSessionSelect({
    contactId: item.contactId,
    sessionId: item.sessionId
  })
  return loadingHistory
}
/**
 * 更新当前Session信息
 */
const setSessionSelect = ({ contactId, sessionId }) => {
  window.ipcRenderer.send('setSessionSelect', { contactId, sessionId })
}

/**
 * 分页查询消息记录
 */
const loadChatMessage = () => historyPager.load()

const loadLocalChatMessage = () => {
  if (messagePageInfo.noData) {
    return
  }
  messagePageInfo.pageNo++
  window.ipcRenderer.send('loadChatMessage', {
    sessionId: currentChatSession.value.sessionId,
    pageNo: messagePageInfo.pageNo,
    maxMessageId: messagePageInfo.maxMessageId
  })
}

/**
 * 接受服务器发来消息
 */
const receiveAiStreamMessage = (message) => {
  const session = chatSessionList.value.find((item) => item.sessionId === message.sessionId)
  if (session) {
    const finalStatus = Number(message.status)
    const preview = message.messageContent || (finalStatus === 2
      ? 'AI 生成已停止'
      : finalStatus === 3
        ? 'AI 生成失败，请重试'
        : finalStatus === 1
          ? 'AI 没有返回文本'
          : 'AI 正在思考…')
    session.lastMessage = `${message.sendUserNickName || session.contactName}: ${preview}`
    session.lastReceiveTime = Number(message.sendTime) || Date.now()
    sortChatSession(chatSessionList.value)
  }

  if (message.sessionId !== currentChatSession.value.sessionId) return

  const aiMessage = { ...message, messageType: 14 }
  const index = messageList.value.findIndex((item) => item.messageId === aiMessage.messageId)
  if (index >= 0) messageList.value.splice(index, 1, aiMessage)
  else messageList.value.push(aiMessage)
  scrollToBottom()
}

const onReceiveMessage = () => {
  window.ipcRenderer.on('receiveMessage', (event, message) => {
    if (message.messageType === 18) {
      chatSessionList.value.forEach((item) => applyContactRemark(item, message.extentData))
      applyContactRemark(currentChatSession.value, message.extentData)
      return
    }
    if (message.messageType === 0) {
      connectionState.value = 'connected'
      void outbox.setOnline(true)
      loadChatSession()
      loadContactApply()
      void readWriter.retry()
      return
    }
    if (message.messageType === 17) {
      const session = chatSessionList.value.find((item) => item.sessionId === message.sessionId)
      if (session) session.peerReadMessageId = Math.max(session.peerReadMessageId || 0, message.messageId || 0)
      if (currentChatSession.value.sessionId === message.sessionId) {
        currentChatSession.value.peerReadMessageId = Math.max(currentChatSession.value.peerReadMessageId || 0, message.messageId || 0)
      }
      return
    }
    //好友申请信息处理
    if (message.messageType === 4) {
      loadContactApply()
      return
    }
    //媒体消息处理
    if (message.messageType === 6) {
      const localMessage = messageList.value.find((item) => {
        return item.messageId === message.messageId
      })
      if (localMessage) {
        localMessage.status = 1
      }
      return
    }
    //强制下线
    if (message.messageType === 7) {
      Confirm({
        message: '您已经被强制下线',
        okfun: () => {
          setTimeout(() => {
            window.ipcRenderer.send('reLogin')
          }, 200)
        },
        showCancelBtn: false
      })
      return
    }
    //更新群昵称
    if (message.messageType === 10) {
      const chatSession = chatSessionList.value.find((item) => {
        return item.contactId === message.contactId
      })
      if (chatSession) chatSession.contactName = message.extentData
      if (currentChatSession.value.contactId === message.contactId) currentChatSession.value.contactName = message.extentData
      return
    }

    // Streaming frames share the initial AI message ID; update its bubble without
    // counting every token frame as another unread message.
    if (message.messageType === 15 || message.messageType === 16) {
      receiveAiStreamMessage(message)
      return
    }

    let currentSession = chatSessionList.value.find((item) => {
      return item.sessionId === message.sessionId
    })
    if (!message.extentData?.sessionId) return
    if (currentSession === null || currentSession === undefined) {
      chatSessionList.value.push(message.extentData)
    } else {
      Object.assign(currentSession, message.extentData)
    }
    sortChatSession(chatSessionList.value)
    messageCountStore.setCount('chatCount', chatSessionList.value.reduce((count, item) => count + (item.noReadCount || 0), 0), true)
    if (message.sessionId !== currentChatSession.value.sessionId) {
      return
    } else {
      // console.log('信息', message, '\n')
      // console.log('列表', messageList.value)
      Object.assign(currentChatSession.value, message.extentData)
      // const current = messageList.value.find((item) => {
      //   return item.sessionId === message.sessionId
      // })
      // if (current) {
      //   Object.assign(current, message)
      // } else {
      //   messageList.value.push(message)
      // }
      const idx = messageList.value.findIndex((item) => item.messageId === message.messageId)
      if (idx > -1) {
        // 用新的 message 对象替换原来的位置
        messageList.value.splice(idx, 1, message)
      } else {
        messageList.value.push(message)
      }

      // 确保滚动跟上
      scrollToBottom()
      markVisibleMessagesRead()
    }
  })
}

/**
 * 接受会话信息
 */
const onLoadChatSession = () => {
  window.ipcRenderer.on('loadChatSessionCallback', (event, data) => {
    let noReadCount = 0
    data.forEach((item) => {
      noReadCount = noReadCount + item.noReadCount
    })
    messageCountStore.setCount('chatCount', noReadCount, true)
    sortChatSession(data)
    chatSessionList.value = data
    //console.log(chatSessionList.value)
  })
}

/**
 * 接受记录信息
 */
const onLoadChatMessage = () => {
  window.ipcRenderer.on('loadChatMessageCallback', (event, { dataList, pageTotal, pageNo, sessionId }) => {
    if (sessionId !== currentChatSession.value.sessionId) return
    if (pageNo === pageTotal) {
      messagePageInfo.noData = true
    }
    dataList.sort((a, b) => {
      return a.messageId - b.messageId
    })
    const lastMessage = messageList.value[0]
    messageList.value = mergeHistoryMessages(messageList.value, dataList)
    markVisibleMessagesRead()
    messagePageInfo.pageNo = pageNo
    messagePageInfo.pageTotal = pageTotal
    if (pageNo === 1) {
      messagePageInfo.maxMessageId =
        dataList.length > 0 ? dataList[dataList.length - 1].messageId : null
      //滚动条滚动到最下面
      scrollToBottom()
    } else {
      nextTick(() => {
        if (lastMessage) document.querySelector('#message' + lastMessage.messageId)?.scrollIntoView()
      })
    }
    //更新完信息console.log(messageList.value)
  })
}

const onAddChatMessage = () => {
  window.ipcRenderer.on('addChatMessageCallback', (event, { status, messageId, error }) => {
    const findMessage = messageList.value.find((item) => {
      return item.messageId === messageId
    })
    if (findMessage) {
      findMessage.status = status
      findMessage.uploadError = error
    }
  })
}

const retryFileMessage = (message) => {
  if (message.status !== 2 || !message.filePath) return
  message.status = 0
  message.uploadError = null
  window.ipcRenderer.send('addChatMessage', { ...message })
}

/**
 * 处理发送消息 接收到了信息
 */
const sendMessage4LocalHandler = (messageObj) => {
  if (currentChatSession.value.sessionId === messageObj.sessionId) {
    messageList.value = mergeHistoryMessages(messageList.value, [messageObj])
    scrollToBottom()
  }
  const chatSession = chatSessionList.value.find((item) => {
    return item.sessionId === messageObj.sessionId
  })
  if (chatSession) {
    chatSession.lastMessage = messageObj.lastMessage
    chatSession.lastReceiveTime = messageObj.sendTime
  }
  sortChatSession(chatSessionList.value)
  scrollToBottom()
}

/**
 * 滚动到底部
 */
const scrollToBottom = () => {
  nextTick(() => {
    //距离底部超过200就不滚动
    if (distanceToBottom > 200) {
      return
    }
    const item = document.querySelectorAll('.message-item')
    if (item.length > 0) {
      setTimeout(() => {
        item[item.length - 1].scrollIntoView()
      }, 170)
    }
  })
}

const loadContactApply = () => {
  window.ipcRenderer.send('loadContactApply')
}

const onLoadContactApply = () => {
  window.ipcRenderer.on('loadContactApplyCallback', (e, contactNoRead) => {
    messageCountStore.setCount('contactApplyCount', contactNoRead, true)
  })
}

const onReloadChatSession = () => {
  window.ipcRenderer.on('reloadChatSessionCallback', (e, { contactId, chatSessions }) => {
    sortChatSession(chatSessions)
    chatSessionList.value = chatSessions
    messageCountStore.setCount('chatCount', chatSessions.reduce((count, item) => count + (item.noReadCount || 0), 0), true)
    sendMessage(contactId)
  })
}

onMounted(() => {
  window.ipcRenderer.on('connectionState', onConnectionState)
  outboxReady = outbox.load().catch((error) => { outboxState.error = '无法加载待发消息：' + error.message })
  window.addEventListener('focus', syncVisibleSession)
  window.addEventListener('blur', syncVisibleSession)
  document.addEventListener('visibilitychange', syncVisibleSession)
  onLoadContactApply()

  onReceiveMessage()

  onLoadChatSession()

  onLoadChatMessage()

  loadChatSession()

  onAddChatMessage()

  scrollToBottom()

  //初始化获取消息未读数
  loadContactApply()

  nextTick(() => {
    const messagePanel = document.querySelector('#message-panel')
    messagePanel.addEventListener('scroll', (e) => {
      const scrollTop = e.target.scrollTop
      //计算滚动距离底 部距离
      distanceToBottom = e.target.scrollHeight - e.target.clientHeight - scrollTop
      if (scrollTop === 0 && messageList.value.length > 0) {
        loadChatMessage()
      }
    })
  })

  setSessionSelect({})

  onReloadChatSession()
})

onUnmounted(() => {
  closeHistorySearch()
  outbox.dispose()
  window.ipcRenderer.removeListener('connectionState', onConnectionState)
  chatDisposed = true
  readWriter.dispose()
  window.removeEventListener('focus', syncVisibleSession)
  window.removeEventListener('blur', syncVisibleSession)
  document.removeEventListener('visibilitychange', syncVisibleSession)
  historyPager.dispose()
  window.ipcRenderer.removeAllListeners('receiveMessage')
  window.ipcRenderer.removeAllListeners('loadChatSessionCallback')
  window.ipcRenderer.removeAllListeners('loadChatMessageCallback')
  window.ipcRenderer.removeAllListeners('addChatMessageCallback')
  window.ipcRenderer.removeAllListeners('loadContactApplyCallback')
  window.ipcRenderer.removeAllListeners('reloadChatSessionCallback')
})

onActivated(() => {
  chatActive = true
  syncVisibleSession()
})
onDeactivated(() => {
  chatActive = false
  setSessionSelect({})
})

//置顶
const setTop = (data) => {
  data.topType = data.topType === 0 ? 1 : 0
  sortChatSession(chatSessionList.value)
  window.ipcRenderer.send('topChatSession', { contactId: data.contactId, topType: data.topType })
}

//删除会话
const deleteChatSession = (contactId) => {
  deleteChatSessionFromList(contactId)
  if (currentChatSession.value.contactId === contactId) {
    setSessionSelect({})
    currentChatSession.value = {}
  }
  window.ipcRenderer.send('deleteChatSession', contactId)
}

//右键菜单
const onContextMenu = (data, e) => {
  ContextMenu.showContextMenu({
    x: e.x,
    y: e.y,
    items: [
      {
        label: data.topType === 0 ? '置顶' : '取消置顶',
        onClick: () => {
          setTop(data)
        }
      },
      {
        label: '移除会话',
        onClick: () => {
          Confirm({
            message: `从列表移除会话“${contactDisplayName(data)}”？聊天记录会保留。`,
            okfun: () => {
              deleteChatSession(data.contactId)
            }
          })
        }
      }
    ]
  })
}
const showMediaDetailHandler = (messageId) => {
  let showFileList = messageList.value.filter((item) => {
    return item.messageType === 5
  })
  showFileList = showFileList.map((item) => {
    return {
      partType: 'chat',
      fileId: item.messageId,
      fileType: item.fileType,
      fileName: item.fileName,
      fileSize: item.fileSize,
      forceGet: false
    }
  })
  window.ipcRenderer.send('newWindow', {
    windowId: 'media',
    title: '图片查看',
    path: '/showMedia',
    data: {
      currentFileId: messageId,
      fileList: showFileList
    }
  })
}
/**
 * 群详情
 */
const chatGroupDetailRef = ref()
const showGroupDetail = () => {
  chatGroupDetailRef.value.show(currentChatSession.value.contactId)
}

/**
 * 跳转到发送信息的处理
 */
const sendMessage = (contactId) => {
  let chatSession = chatSessionList.value.find((item) => {
    return item.contactId === contactId
  })
  if (!chatSession) {
    window.ipcRenderer.send('reloadChatSession', { contactId })
    return
  } else {
    chatSessionClickHandler(chatSession)
  }
}

/**
 * 置顶栏搜索的视线
 */
const searchKey = ref()
const searchList = ref([])
const search = () => {
  if (!searchKey.value) {
    return
  }
  searchList.value = []
  chatSessionList.value.forEach((item) => {
    const contactName = contactDisplayName(item)
    const lastMessage = messageText(item.lastMessage)
    const query = searchKey.value.toLocaleLowerCase()
    if (contactName.toLocaleLowerCase().includes(query) || String(item.contactName || '').toLocaleLowerCase().includes(query) || lastMessage.toLocaleLowerCase().includes(query)) {
      let newData = Object.assign({}, item)
      newData.searchContactParts = highlightText(contactName, searchKey.value)
      newData.searchLastParts = highlightText(lastMessage, searchKey.value)
      searchList.value.push(newData)
    }
  })
}

const searchClickHandler = (item) => {
  searchKey.value = null
  chatSessionClickHandler(item)
}

/**
 * 监听跳转联系人
 */
watch(
  () => route.query.timestamp,
  (newVal) => {
    if (newVal && route.query.chatId) {
      sendMessage(route.query.chatId)
    }
  },
  { immediate: true, deep: true }
)
</script>

<style scoped lang="less">
.hidden-session-list { list-style: none; padding: 0; }
.hidden-session-list li { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; }
.connection-status { padding: 6px 12px; color: #875800; background: #fff8df; font-size: 12px; }
.history-search-form { display: flex; gap: 8px; }
.history-search-form .el-select { width: 150px; flex-shrink: 0; }
.history-search-results { list-style: none; padding: 0; max-height: 400px; overflow: auto; }
.history-search-results button { width: 100%; text-align: left; padding: 12px; border: 0; border-bottom: 1px solid #ddd; background: white; cursor: pointer; }
.history-search-results small { display: block; color: #667085; margin: 4px 0; }
.history-search-results span { white-space: pre-wrap; overflow-wrap: anywhere; }
.highlight { color: #a63d00; background: #fff2bd; }
.history-match { outline: 2px solid #dba74e; border-radius: 6px; }
.pending-message { text-align: right; padding: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
.pending-message small { display: block; color: #667085; margin-top: 4px; }
.drag-panel {
  height: 25px;
  background: #f7f7f7;
}

.top-search {
  padding: 0 10px 9px 10px;
  background: #f7f7f7;
  display: flex;
  align-items: center;

  .iconfont {
    font-size: 12px;
  }
}

.chat-session-list {
  height: calc(100vh - 62px);
  overflow: hidden;
  border-top: 1px solid #ddd;

  &:hover {
    overflow: auto;
  }
}

.search-list {
  height: calc(100vh - 62px);
  background: #f7f7f7;
  overflow: hidden;

  &:hover {
    overflow: auto;
  }
}

.title-panel {
  display: flex;
  align-items: center;

  .title {
    height: 60px;
    line-height: 60px;
    padding-left: 10px;
    font-size: 18px;
    color: #000000;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.icon-more {
  position: absolute;
  z-index: 1;
  top: 30px;
  right: 3px;
  width: 20px;
  font-size: 20px;
  margin-right: 5px;
  cursor: pointer;
}

.chat-panel {
  border-top: 1px solid #ddd;
  background: #f5f5f5;

  .message-panel {
    padding: 10px 30px 0 30px;
    height: calc(100vh - 200px - 62px);
    overflow-y: auto;

    .message-item {
      margin-bottom: 15px;
      text-align: center;
    }
  }
}
</style>
