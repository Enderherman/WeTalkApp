import { onUnmounted } from 'vue'

export function useIpcListeners() {
  const cleanups = new Set()
  onUnmounted(() => {
    for (const unsubscribe of cleanups) unsubscribe()
    cleanups.clear()
  })
  return {
    on(channel, listener) {
      const unsubscribe = window.ipcRenderer.on(channel, listener)
      cleanups.add(unsubscribe)
      return () => { unsubscribe(); cleanups.delete(unsubscribe) }
    }
  }
}
