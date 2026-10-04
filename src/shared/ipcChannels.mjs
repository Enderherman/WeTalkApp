export const sendChannels = Object.freeze([
  'loginOrRegister', 'openChat', 'winTitleOp', 'setLocalStore', 'getLocalStore',
  'retryConnection', 'loadChatSession', 'deleteChatSession', 'topChatSession',
  'loadChatMessage', 'setSessionSelect', 'addChatMessage', 'newWindow', 'saveAs',
  'saveClipBoardFile', 'loadContactApply', 'clearMessageCount', 'reLogin',
  'openLocalFolder', 'systemSettingsUpdated', 'getSysSetting', 'changeLocalFolder',
  'reloadChatSession', 'openUrl', 'downloadUpdate', 'loadLocalUser'
])
export const invokeChannels = Object.freeze([
  'loadHiddenChatSessions', 'textOutbox:load', 'textOutbox:save', 'textOutbox:remove',
  'cacheChatHistory', 'saveReadCursor', 'createCover'
])
export const receiveChannels = Object.freeze([
  'getLocalStoreCallback', 'loadChatSessionCallback', 'loadChatMessageCallback',
  'addChatMessageCallback', 'pageInitData', 'saveClipBoardFileCallback',
  'loadContactApplyCallback', 'reLogin', 'systemSettingsUpdated', 'getSysSettingCallback',
  'reloadChatSessionCallback', 'downloadUpdateCallback', 'loadLocalUserCallback',
  'receiveMessage', 'connectionState', 'copyCallback'
])
