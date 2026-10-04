import { mergeChatMessage } from '../../../shared/chatMessageMerge.mjs'

export function mergeHistoryMessages(existing, incoming) {
  const byId = new Map(existing.map((message) => [message.messageId, message]))
  for (const message of incoming) {
    const previous = byId.get(message.messageId)
    byId.set(message.messageId, mergeChatMessage(previous, message))
  }
  return [...byId.values()].sort((a, b) => a.messageId - b.messageId)
}

export function createHistoryPager({ state, fetchPage, onPage, onFailure, pageSize = 30 }) {
  let generation = 0
  function reset(contactId, beforeMessageId = null) {
    generation++
    Object.assign(state, { contactId, cursor: beforeMessageId, loading: false, hasMore: true, error: '', loaded: false })
  }
  async function load() {
    if (!state.contactId || state.loading || !state.hasMore) return
    const version = generation, contactId = state.contactId, before = state.cursor
    state.loading = true
    state.error = ''
    try {
      const page = await fetchPage(contactId, before, pageSize)
      if (version !== generation) return
      if (!page || !Array.isArray(page.list)) throw new Error('历史消息加载失败')
      await onPage(page.list, { contactId, append: state.loaded, isCurrent: () => version === generation })
      if (version !== generation) return
      const ids = page.list.map((message) => Number(message.messageId)).filter((id) => Number.isSafeInteger(id) && id > 0)
      const cursor = ids.length ? Math.min(...ids) : null
      state.hasMore = page.list.length >= pageSize && cursor !== null && (before === null || cursor < before)
      state.cursor = cursor
      state.loaded = true
    } catch (error) {
      if (version !== generation) return
      state.error = '无法连接服务器历史，显示本地缓存；可重新加载'
      await onFailure?.({ contactId })
    } finally { if (version === generation) state.loading = false }
  }
  return { reset, load, dispose: () => { generation++ } }
}
