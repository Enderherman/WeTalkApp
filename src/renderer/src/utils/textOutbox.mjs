export function createTextOutbox({ state, storage, send, onSent, userId, id = () => crypto.randomUUID(), now = Date.now }) {
  let disposed = false, flushing = false
  const acknowledged = new Set()
  async function flush() {
    if (disposed || flushing || !state.online) return
    flushing = true
    try {
      while (!disposed && state.online) {
        const item = state.items[0]
        if (!item || item.status !== 'queued') break
        item.status = 'sending'
        try {
          const response = await send(item)
          if (disposed) return
          if (!response) throw new Error('消息发送失败，请重试')
          await onSent(response, item)
          await storage.remove(item.clientMessageId)
          state.items = state.items.filter((draft) => draft.clientMessageId !== item.clientMessageId)
        } catch (error) {
          if (disposed) return
          if (acknowledged.has(item.clientMessageId)) continue
          item.status = 'failed'
          item.retryable = Boolean(error.retryable)
          item.error = error.message || '消息发送失败，请重试'
          await storage.put({ ...item })
          // Preserve queue order: later drafts wait until this one is retried or discarded.
          break
        } finally { acknowledged.delete(item.clientMessageId) }
      }
    } catch (error) { state.error = error.message || '无法保存待发消息状态' }
    finally { flushing = false }
  }
  return {
    async acknowledge(message) {
      if (disposed || message.sendUserId !== userId || Number(message.messageType) !== 2 || !Number.isSafeInteger(message.messageId)) return false
      const item = state.items.find((draft) => draft.clientMessageId === message.clientMessageId && draft.contactId === message.contactId && draft.sessionId === message.sessionId)
      if (!item) return false
      acknowledged.add(item.clientMessageId)
      // Remove the pending bubble in the same render tick as the authoritative
      // echo; a later HTTP timeout must not resurrect the accepted draft.
      state.items = state.items.filter((draft) => draft.clientMessageId !== item.clientMessageId)
      try { await storage.remove(item.clientMessageId) }
      catch (error) { if (!disposed) state.error = error.message || '已发送草稿缓存清理失败' }
      if (!flushing) { acknowledged.delete(item.clientMessageId); void flush() }
      return true
    },
    async load() {
      const items = await storage.load()
      if (disposed) return
      state.items = items.map((item) => ({ ...item, status: item.status === 'sending' ? 'queued' : item.status }))
      state.ready = true
      await flush()
    },
    async enqueue({ contactId, sessionId, messageContent }) {
      if (disposed) throw new Error('会话已退出')
      if (!contactId || !sessionId) throw new Error('请先选择聊天会话')
      const content = String(messageContent || '').trimEnd()
      if (!content.trim() || content.length > 500) throw new Error('文字消息需为 1 至 500 个字符')
      const item = { clientMessageId: id(), contactId, sessionId, messageContent: content, createdAt: now(), status: 'queued', error: '' }
      await storage.put(item)
      if (disposed) return
      state.items.push(item)
      void flush()
      return item.clientMessageId
    },
    async retry(clientMessageId) {
      const item = state.items.find((draft) => draft.clientMessageId === clientMessageId)
      if (!item || item.status === 'sending') return
      item.status = 'queued'; item.error = ''
      await storage.put({ ...item })
      await flush()
    },
    async discard(clientMessageId) {
      const item = state.items.find((draft) => draft.clientMessageId === clientMessageId)
      if (!item || item.status === 'sending') return
      await storage.remove(clientMessageId)
      state.items = state.items.filter((draft) => draft.clientMessageId !== clientMessageId)
      await flush()
    },
    async setOnline(online) {
      state.online = online
      if (online && state.ready) {
        for (const item of state.items) {
          if (item.status === 'failed' && item.retryable) {
            item.status = 'queued'; item.error = ''
            await storage.put({ ...item })
          }
        }
        return flush()
      }
    },
    flush,
    dispose() { disposed = true }
  }
}
