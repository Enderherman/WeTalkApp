export function desktopRouteAccess(path, token, profile) {
  if (path === '/login') return true
  if (!token) return '/login'
  if (path.startsWith('/admin') && profile?.admin !== true) return '/chat'
  return true
}

export function clearRendererSession(storage, stores = []) {
  storage.removeItem('token')
  storage.removeItem('userInfo')
  for (const store of stores) store.$reset()
}
