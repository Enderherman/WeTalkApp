export function createReadCursorWriter({ send, onConfirmed = () => {} }) {
  const pending = new Map(), confirmed = new Map(), running = new Set()
  let disposed = false
  async function flush(contactId) {
    if (disposed || running.has(contactId)) return
    running.add(contactId)
    try {
      while (!disposed && pending.has(contactId)) {
        const messageId = pending.get(contactId)
        const success = await send(contactId, messageId)
        if (disposed || !success) return
        confirmed.set(contactId, Math.max(confirmed.get(contactId) || 0, messageId))
        if (pending.get(contactId) <= messageId) pending.delete(contactId)
        await onConfirmed(contactId, messageId)
      }
    } catch { /* Keep the desired cursor for the next connection/focus retry. */ }
    finally { running.delete(contactId) }
  }
  return {
    mark(contactId, messageId) {
      if (disposed || !contactId || !Number.isSafeInteger(messageId) || messageId <= 0 || messageId <= (confirmed.get(contactId) || 0)) return Promise.resolve()
      pending.set(contactId, Math.max(pending.get(contactId) || 0, messageId))
      return flush(contactId)
    },
    retry: () => Promise.all([...pending.keys()].map(flush)),
    dispose: () => { disposed = true; pending.clear() }
  }
}

export function canMarkVisibleSession({ active, visible, focused, contactId }) {
  return Boolean(active && visible && focused && contactId)
}
