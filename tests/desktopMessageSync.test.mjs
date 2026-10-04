import test from 'node:test'
import assert from 'node:assert/strict'
import { createDesktopMessageSync } from '../src/main/utils/desktopMessageSync.mjs'

function fixture() {
  const messages = new Map(), sessions = new Map(), emitted = [], receipts = [], remarks = []
  let applications = 0
  const deps = {
    userId: () => 'Uself', currentSessionId: () => null,
    saveSessions: async (items) => items.forEach((item) => sessions.set(item.contactId, { ...item })),
    saveMessages: async (items) => items.forEach((item) => messages.set(item.messageId, { ...item })),
    updateApplications: async (value, replace) => { applications = replace ? value : applications + value },
    findMessage: async (id) => messages.get(id), saveMessage: async (item) => messages.set(item.messageId, { ...item }),
    saveSession: async (_, item, { incrementUnread }) => {
      const before = sessions.get(item.contactId)
      sessions.set(item.contactId, { ...before, ...item, noReadCount: (before?.noReadCount || 0) + Number(incrementUnread) })
    },
    findSession: async (id) => sessions.get(id), updateReadReceipt: async (item) => receipts.push(item),
    updateMessage: async (value, { messageId }) => messages.set(messageId, { ...messages.get(messageId), ...value }),
    updateContactName: async () => {}, close: () => {}, emit: (item) => emitted.push(item),
    updateContactRemark: async (contactId, remark) => remarks.push({ contactId, remark })
  }
  return { sync: createDesktopMessageSync(deps), messages, sessions, emitted, receipts, remarks, applications: () => applications }
}
const message = (type, id = 1) => ({ messageType: type, messageId: id, sessionId: 'session', contactId: 'Upeer', contactType: 0, sendUserId: 'Upeer', messageContent: 'content', status: 1 })

test('files and system events retain their persisted types without mutating frames', async () => {
  const f = fixture()
  for (const type of [1, 2, 3, 5, 8, 9, 11, 12]) {
    const frame = message(type, type)
    await f.sync(frame)
    assert.equal(f.messages.get(type).messageType, type)
    assert.equal(frame.messageType, type)
  }
})

test('AI cumulative frames update one row, persist terminal status and count one unread', async () => {
  const f = fixture()
  await f.sync({ ...message(14), messageContent: '', status: 0 })
  await f.sync({ ...message(15), messageContent: 'hello', status: 0 })
  await f.sync({ ...message(16), messageContent: 'hello world', status: 2 })
  assert.equal(f.messages.size, 1)
  assert.equal(f.messages.get(1).messageContent, 'hello world')
  assert.equal(f.messages.get(1).status, 2)
  assert.equal(f.messages.get(1).messageType, 14)
  assert.equal(f.sessions.get('Upeer').noReadCount, 1)
})

test('duplicate frames never add another unread; own messages are not unread', async () => {
  const f = fixture()
  await f.sync(message(5))
  await f.sync(message(5))
  await f.sync({ ...message(2, 2), sendUserId: 'Uself' })
  assert.equal(f.sessions.get('Upeer').noReadCount, 1)
  assert.equal(f.emitted[1].duplicate, true)
})

test('repeated INIT replaces counts and does not count hydrated history again', async () => {
  const f = fixture()
  const init = { messageType: 0, extentData: { chatSessionList: [{ contactId: 'Upeer', noReadCount: 2 }], chatMessageList: [message(2)], applyCount: 3 } }
  await f.sync(init)
  await f.sync(init)
  assert.equal(f.sessions.get('Upeer').noReadCount, 2)
  assert.equal(f.applications(), 3)
  assert.equal(f.messages.size, 1)
})

test('read receipts and upload completion never become chat messages', async () => {
  const f = fixture()
  await f.sync(message(17))
  assert.equal(f.messages.size, 0)
  assert.equal(f.sessions.size, 0)
  assert.equal(f.receipts.length, 1)
  await f.sync({ ...message(5), status: 0 })
  await f.sync({ ...message(6), status: 1 })
  assert.equal(f.messages.get(1).messageType, 5)
  assert.equal(f.messages.get(1).status, 1)
  assert.equal(f.sessions.get('Upeer').noReadCount, 1)
})

test('remark events update private contact metadata without adding history or unread', async () => {
  const f = fixture()
  await f.sync({ messageType: 18, extentData: { contactId: 'Upeer', remark: '同事' } })
  await f.sync({ messageType: 18, extentData: { contactId: 'Upeer', remark: '' } })
  assert.deepEqual(f.remarks, [{ contactId: 'Upeer', remark: '同事' }, { contactId: 'Upeer', remark: '' }])
  assert.equal(f.messages.size, 0)
  assert.equal(f.sessions.size, 0)
  assert.equal(f.emitted.length, 2)
})

test('file completion persists final metadata without another unread or a type 6 history row', async () => {
  const f = fixture()
  await f.sync({ ...message(5), fileName: 'clip.mov', fileSize: 1000, fileType: 1, status: 0 })
  await f.sync({ ...message(6), fileName: 'clip.mov', fileSize: 640, fileType: 1, status: 1 })
  await f.sync({ ...message(6), fileName: 'clip.mov', fileSize: 640, fileType: 1, status: 1 })
  assert.equal(f.messages.size, 1)
  assert.equal(f.messages.get(1).fileSize, 640)
  assert.equal(f.messages.get(1).messageType, 5)
  assert.equal(f.sessions.get('Upeer').noReadCount, 1)
  assert.equal(f.emitted.at(-1).fileSize, 640)
})

test('an own completion arriving before its placeholder keeps final metadata and has zero unread', async () => {
  const f = fixture()
  await f.sync({ ...message(6), sendUserId: 'Uself', fileName: 'clip.mov', fileSize: 640, fileType: 1, status: 1 })
  await f.sync({ ...message(5), sendUserId: 'Uself', fileName: 'clip.mov', fileSize: 1000, fileType: 1, status: 0 })
  assert.equal(f.messages.size, 1)
  assert.equal(f.messages.get(1).status, 1)
  assert.equal(f.messages.get(1).fileSize, 640)
  assert.equal(f.messages.get(1).messageType, 5)
  assert.equal(f.sessions.get('Upeer').noReadCount, 0)
})

test('finishing an older upload does not replace a newer conversation preview', async () => {
  const f = fixture()
  await f.sync({ ...message(5, 1), fileName: 'clip.mov', fileSize: 1000, fileType: 1, status: 0, sendTime: 1 })
  await f.sync({ ...message(2, 2), messageContent: 'newest text', sendTime: 2 })
  await f.sync({ ...message(6, 1), fileName: 'clip.mov', fileSize: 640, fileType: 1, status: 1, sendTime: 1 })
  assert.equal(f.sessions.get('Upeer').lastMessage, 'newest text')
  assert.equal(f.sessions.get('Upeer').lastReceiveTime, 2)
  assert.equal(f.sessions.get('Upeer').noReadCount, 2)
})
