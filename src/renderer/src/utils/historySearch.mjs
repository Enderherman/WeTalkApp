import { messageText } from './messageText.mjs'
import { contactDisplayName } from './contactRemark.mjs'

export function createHistorySearch({ state, fetchPage, pageSize = 50 }) {
  let generation = 0
  return {
    cancel() { generation++; state.loading = false },
    async run(sessions, input) {
      const version = ++generation
      const keyword = String(input || '').trim().toLocaleLowerCase()
      Object.assign(state, { results: [], error: '', loading: Boolean(keyword), scanned: 0 })
      if (!keyword) return
      const found = new Set()
      try {
        for (const session of sessions) {
          let before = null
          while (version === generation) {
            let page
            try {
              page = await fetchPage(session.contactId, before, pageSize)
              if (!page || !Array.isArray(page.list)) throw new Error('历史不可用')
            } catch {
              if (version === generation) state.error = '部分会话历史无法读取，结果可能不完整；请稍后重试'
              break
            }
            if (version !== generation) return
            state.scanned += page.list.length
            for (const message of page.list) {
              const key = `${session.sessionId}:${message.messageId}`
              const content = messageText(message.messageContent)
              if (!found.has(key) && `${content}\n${message.fileName || ''}`.toLocaleLowerCase().includes(keyword)) {
                found.add(key)
                state.results.push({ ...message, sourceContactId: session.contactId, sourceContactName: contactDisplayName(session), searchText: content || message.fileName || '' })
              }
            }
            state.results.sort((a, b) => b.messageId - a.messageId)
            const ids = page.list.map((message) => message.messageId).filter((id) => Number.isSafeInteger(id) && id > 0)
            const next = ids.length ? Math.min(...ids) : null
            if (page.list.length < pageSize || next === null) break
            if (before !== null && next >= before) { state.error = '历史分页未前进，请重试'; break }
            before = next
          }
          if (version !== generation) return
        }
      } finally { if (version === generation) state.loading = false }
    }
  }
}
