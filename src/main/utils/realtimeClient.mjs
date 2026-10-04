// A connection owns one heartbeat and one reconnect timer. Generations prevent
// queued callbacks from a signed-out account from touching the next account.
export function createRealtimeClient({ createSocket, onMessage, onState = () => {}, onError = () => {}, timers = globalThis, heartbeatMs = 5000, reconnectMs = 5000, maxReconnects = 5 }) {
  let socket = null, heartbeat = null, reconnect = null, generation = 0, attempts = 0
  let active = false, address, queue = Promise.resolve()
  function stop() {
    active = false
    generation++
    if (heartbeat !== null) timers.clearInterval(heartbeat)
    if (reconnect !== null) timers.clearTimeout(reconnect)
    heartbeat = reconnect = null
    const previous = socket
    socket = null
    previous?.close()
    onState('disconnected')
  }
  function connect(version) {
    if (!active || version !== generation) return
    let current
    const valid = () => active && generation === version && socket === current
    const schedule = () => {
      if (attempts++ >= maxReconnects) { onState('failed'); return }
      onState('reconnecting')
      reconnect = timers.setTimeout(() => { reconnect = null; connect(version) }, reconnectMs)
    }
    const retry = () => {
      if (!valid()) return
      socket = null
      if (heartbeat !== null) timers.clearInterval(heartbeat)
      heartbeat = null
      current.close()
      schedule()
    }
    try { current = createSocket(address); socket = current }
    catch (error) { onError(error); schedule(); return }
    current.onopen = () => {
      if (!valid()) return
      attempts = 0
      onState('connected')
      current.send('heart beat')
      if (heartbeat !== null) timers.clearInterval(heartbeat)
      heartbeat = timers.setInterval(() => {
        if (valid() && current.readyState === 1) current.send('heart beat')
      }, heartbeatMs)
    }
    current.onmessage = (event) => {
      if (!valid()) return
      queue = queue.then(async () => {
        if (!valid()) return
        const message = JSON.parse(String(event.data))
        if (message && typeof message === 'object') await onMessage(message, valid)
      }).catch(onError)
    }
    current.onclose = retry
    current.onerror = (error) => { if (valid()) { onError(error); retry() } }
  }
  return {
    start(url) { stop(); address = url; active = true; attempts = 0; queue = Promise.resolve(); onState('connecting'); connect(generation) },
    stop,
    settled: () => queue
  }
}
