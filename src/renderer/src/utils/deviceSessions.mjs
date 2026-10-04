export const deviceSessionEndpoints = {
  listSessions: '/account/listSessions',
  revokeSession: '/account/revokeSession',
  revokeOtherSessions: '/account/revokeOtherSessions'
}

export function createDeviceSessionManager(request, state) {
  async function perform(action) {
    if (state.busy) return false
    state.busy = true
    state.error = ''
    try { await action(); return true }
    catch (error) { state.error = error.message || '设备操作失败，请重试'; return false }
    finally { state.busy = false }
  }
  async function refresh() {
    const result = await request({ url: deviceSessionEndpoints.listSessions, showLoading: false, showError: false })
    if (!result || !Array.isArray(result.data)) throw new Error('无法读取登录设备，请重试')
    state.sessions = result.data
  }
  return {
    load: () => perform(refresh),
    revoke: (session) => perform(async () => {
      if (session.current) throw new Error('当前设备请使用退出登录')
      const result = await request({ url: deviceSessionEndpoints.revokeSession, params: { sessionId: session.sessionId }, showLoading: false, showError: false })
      if (!result) throw new Error('撤销设备失败，请重试')
      await refresh()
    }),
    revokeOthers: () => perform(async () => {
      const result = await request({ url: deviceSessionEndpoints.revokeOtherSessions, showLoading: false, showError: false })
      if (!result) throw new Error('退出其他设备失败，请重试')
      await refresh()
    })
  }
}
