export function createContactApplicationPager({ state, request }) {
  let generation = 0
  async function load(reset = false) {
    if (reset) { generation++; Object.assign(state, { pageNo: 0, pageTotal: 1, loading: false, error: '' }) }
    if (state.loading || state.pageNo >= state.pageTotal) return
    const version = generation, pageNo = state.pageNo + 1
    state.loading = true
    state.error = ''
    try {
      const result = await request({ url: '/contact/loadApply', params: { pageNo }, showLoading: false, showError: false })
      if (version !== generation) return
      if (!result?.data || !Array.isArray(result.data.list)) throw new Error('申请列表加载失败，请重试')
      const items = new Map((pageNo === 1 ? [] : state.items).map((item) => [item.applyId, item]))
      result.data.list.forEach((item) => items.set(item.applyId, item))
      state.items = [...items.values()]
      state.pageNo = pageNo
      state.pageTotal = Math.max(0, Number(result.data.pageTotal) || 0)
    } catch (error) { if (version === generation) state.error = error.message || '申请列表加载失败，请重试' }
    finally { if (version === generation) state.loading = false }
  }
  return { load: () => load(), reload: () => load(true), dispose: () => { generation++ } }
}
