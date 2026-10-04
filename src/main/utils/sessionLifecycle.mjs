export async function clearDesktopSession({ store, closeSocket, closeMedia, windows, mainWindow, resetWindow }) {
  closeSocket()
  store.deleteUserData('token')
  store.deleteUserData('currentSessionId')
  store.deleteUserData('admin')
  store.initUserId(null)
  for (const window of windows) if (window !== mainWindow && !window.isDestroyed()) window.close()
  try { await closeMedia() } finally {
    resetWindow()
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('reLogin')
  }
}
