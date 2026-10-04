export function createDesktopRequest({ post, getToken, showLoading, onExpired, onError }) {
  return async function request(config) {
    const { url, params = {}, dataType, responseType = 'json', showError = true } = config
    const token = getToken()
    const loading = config.showLoading === false ? null : showLoading()
    try {
      const headers = { 'X-Requested-With': 'XMLHttpRequest', ...(token ? { token } : {}) }
      let data
      if (dataType === 'json') { data = params; headers['Content-Type'] = 'application/json' }
      else {
        data = new FormData()
        for (const [key, value] of Object.entries(params)) {
          // Forms keep existing avatar IDs for display; only a selected binary
          // file belongs in Spring's optional MultipartFile parameters.
          if (['avatarFile', 'coverFile', 'robotFile', 'robotCover', 'file'].includes(key) && !(value instanceof Blob)) continue
          data.append(key, value === null || value === undefined ? '' : value)
        }
      }
      const response = await post(url, data, { headers, responseType, signal: config.signal })
      if (token && token !== getToken()) return null
      if (responseType === 'arraybuffer' || responseType === 'blob') return response.data
      const result = response.data
      if (result?.code === 200) return result
      if (result?.code === 901) {
        if (token === getToken()) onExpired()
        return null
      }
      config.errorCallback?.(result)
      if (showError) onError(result?.message || '请求失败，请重试')
      return null
    } catch (error) {
      if (error.name === 'CanceledError' || error.name === 'AbortError') return null
      const result = error.response?.data
      if ((error.response?.status === 401 || result?.code === 901) && token === getToken()) onExpired()
      else if (showError) onError(result?.message || '网络异常，请检查连接后重试')
      return null
    } finally { loading?.close() }
  }
}
