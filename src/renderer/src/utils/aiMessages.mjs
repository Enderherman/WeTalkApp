export function aiMessageState(message, robotUid) {
  if (!message || (message.messageType !== 14 && (!robotUid || message.sendUserId !== robotUid))) return null
  if (message.messageType === 5) return null
  if (Number(message.status) === 2) return 'cancelled'
  if (Number(message.status) === 3) return 'failed'
  if (Number(message.status) === 1) return 'complete'
  return message.messageContent ? 'streaming' : 'waiting'
}

export const aiStateLabels = { waiting: 'AI 正在思考…', streaming: '正在生成…', complete: '生成完成', cancelled: '已停止生成', failed: '生成失败，请重新发送' }

export function createAiStopper({ request, state, onMessage, isActive = () => true }) {
  return async (message) => {
    if (state.stoppingId !== null) return
    state.stoppingId = message.messageId
    delete state.errors[message.messageId]
    try {
      const result = await request({ url: '/chat/cancelAiMessage', params: { messageId: message.messageId }, showLoading: false, showError: false })
      if (!isActive()) return
      if (!result?.data) throw new Error('停止生成失败，请重试')
      await onMessage({ ...message, ...result.data, messageType: 16 })
    } catch (error) { state.errors[message.messageId] = error.message || '停止生成失败，请重试' }
    finally { state.stoppingId = null }
  }
}
