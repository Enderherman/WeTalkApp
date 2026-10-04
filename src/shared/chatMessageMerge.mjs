const fileMetadata = ['fileName', 'fileSize', 'fileType', 'messageContent']

export function mergeChatMessage(previous, incoming) {
  const values = Object.fromEntries(Object.entries(incoming).filter(([, value]) => value !== undefined))
  if (values.filePath === null || values.filePath === '') delete values.filePath
  const completedEvent = Number(incoming.messageType) === 6
  const messageType = completedEvent ? 5 : Number(incoming.messageType ?? previous?.messageType)
  const merged = { ...previous, ...values }
  if (Number.isFinite(messageType)) merged.messageType = messageType
  if (completedEvent) merged.status = 1
  // HTTP acceptance, old history, and upload-failure callbacks can arrive after
  // the server's final file event. They must not roll confirmed metadata back.
  if (!completedEvent && Number(previous?.messageType) === 5 && Number(previous?.status) === 1 && messageType === 5 && Number(incoming.status) !== 1) {
    merged.status = 1
    for (const key of fileMetadata) if (previous[key] !== undefined && previous[key] !== null) merged[key] = previous[key]
  }
  if (Number(merged.messageType) === 5 && Number(merged.status) === 1) delete merged.uploadError
  return merged
}
