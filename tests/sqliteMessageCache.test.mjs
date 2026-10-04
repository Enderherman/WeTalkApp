import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import Module, { createRequire } from 'node:module'
import { build } from 'esbuild'
import { createDesktopMessageSync } from '../src/main/utils/desktopMessageSync.mjs'

for (const legacy of [false, true]) test(`real SQLite ${legacy ? 'legacy migration' : 'new cache'} preserves types, counts, remarks and cursors`, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wetalk-cache-test-'))
  const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
  const require = createRequire(import.meta.url)
  const sqlite = require('sqlite3')
  const NativeDatabase = sqlite.Database
  let database
  sqlite.Database = function (...args) { database = new NativeDatabase(...args); return database }
  let api
  try {
    if (legacy) {
      const folder = path.join(directory, process.env.NODE_ENV === 'development' ? '.weTalkDev' : '.weTalk')
      await mkdir(folder)
      const oldDatabase = new NativeDatabase(path.join(folder, 'local.db'))
      await new Promise((resolve, reject) => oldDatabase.exec(`
        CREATE TABLE chat_session_user(user_id varchar, contact_id varchar, contact_type integer, session_id varchar, status integer default 1, contact_name varchar, last_message varchar, last_receive_time bigint, no_read_count integer default 0, member_count integer, top_type integer default 0, PRIMARY KEY(user_id,contact_id));
        CREATE TABLE user_setting(user_id varchar PRIMARY KEY,email varchar,sys_setting varchar,contact_no_read integer,server integer);
        CREATE TABLE chat_message(user_id varchar NOT NULL,message_id integer NOT NULL,session_id varchar,message_type integer,message_content varchar,contact_type integer,send_user_id varchar,send_user_nick_name varchar,send_time bigint,status integer,file_size bigint,file_name varchar,file_path varchar,file_type integer,PRIMARY KEY(user_id,message_id));
      `, (error) => error ? reject(error) : resolve()))
      await new Promise((resolve, reject) => oldDatabase.close((error) => error ? reject(error) : resolve()))
    }
    const result = await build({
      stdin: { contents: "export * from './src/main/database/ADB.js'; export * from './src/main/database/ChatSessionUserModel.js'; export * from './src/main/database/ChatMessageModel.js'; export * from './src/main/database/TextOutboxModel.js'; export { default as testStore } from './src/main/store'", resolveDir: root },
      bundle: true, write: false, platform: 'node', format: 'cjs', external: ['sqlite3'],
      plugins: [{ name: 'isolated-user-data', setup(builder) {
        builder.onResolve({ filter: /^os$/ }, () => ({ path: 'test-os', namespace: 'test' }))
        builder.onResolve({ filter: /(^|\/)store$/ }, () => ({ path: 'test-store', namespace: 'test' }))
        builder.onLoad({ filter: /.*/, namespace: 'test' }, ({ path: id }) => ({ contents: id === 'test-os'
          ? `export const homedir = () => ${JSON.stringify(directory)}`
          : "const store = { userId: 'Utest', getUserId: () => store.userId }; export default store" }))
      } }]
    })
    const compiled = new Module(path.join(root, 'tests', 'cache-harness.cjs'))
    compiled.paths = Module._nodeModulePaths(root)
    compiled._compile(result.outputFiles[0].text, compiled.id)
    api = compiled.exports
    await api.databaseReady
    assert.ok((await api.queryAll('pragma table_info(user_setting)', [])).some((column) => column.name === 'server_port'))
    await api.saveOrUpdateChatSessionUserBatch4Init([{ contactId: 'Upeer', sessionId: 'session', contactName: '昵称', noReadCount: 3, peerReadMessageId: 2 }])
    await api.saveMessageBatch([{ messageId: 10, sessionId: 'session', messageType: 5, status: 1, fileName: 'test.txt' }])
    await api.saveMessageBatch([{ messageId: 10, sessionId: 'session', messageType: 5, status: 1, fileName: 'test.txt' }])
    assert.equal((await api.selectUserSessionByContactId('Upeer')).noReadCount, 3)
    assert.equal((await api.selectChatMessagesByMessageId(10)).messageType, 5)
    await api.updateContactRemark('Upeer', '同事')
    assert.equal((await api.selectUserSessionByContactId('Upeer')).remark, '同事')
    await api.updatePeerReadMessageId({ messageId: 8, sessionId: 'session' })
    await api.updatePeerReadMessageId({ messageId: 4, sessionId: 'session' })
    assert.equal((await api.selectUserSessionByContactId('Upeer')).peerReadMessageId, 8)
    await api.updateReadCursor('Upeer', 10)
    await api.updateReadCursor('Upeer', 4)
    const readSession = await api.selectUserSessionByContactId('Upeer')
    assert.equal(readSession.lastReadMessageId, 10)
    assert.equal(readSession.noReadCount, 0)
    await api.updateContactRemark('Upeer', '')
    assert.equal((await api.selectUserSessionByContactId('Upeer')).remark, '')
    await api.saveTextDraft({ clientMessageId: 'key-1', contactId: 'Upeer', sessionId: 'session', messageContent: 'offline', createdAt: 1, status: 'queued' })
    assert.equal((await api.loadTextOutbox())[0].messageContent, 'offline')
    await api.removeTextDraft('key-1')
    assert.equal((await api.loadTextOutbox()).length, 0)
    await api.insertOrIgnore('chat_session_user', { userId: 'Uother', contactId: 'Upeer', sessionId: 'other', contactName: 'other account', lastMessage: 'keep private' })
    const oldAccountWrite = api.saveOrUpdateChatSessionByMessage(null, { contactId: 'Upeer', sessionId: 'session', lastMessage: 'old account update', lastReceiveTime: 1 })
    api.testStore.userId = 'Uother'
    await oldAccountWrite
    assert.equal((await api.selectUserSessionByContactId('Upeer')).lastMessage, 'keep private')
    api.testStore.userId = 'Utest'
    assert.equal((await api.selectUserSessionByContactId('Upeer')).lastMessage, 'old account update')
    await api.topChatSessionUser('Upeer', 1)
    await api.deleteChatSessionUser('Upeer')
    await api.saveOrUpdateChatSessionUserBatch4Init([{ contactId: 'Upeer', sessionId: 'session', lastMessage: 'old account update', lastReceiveTime: 1 }])
    assert.equal((await api.selectHiddenChatSessions()).length, 1)
    assert.equal((await api.selectChatSessionUser()).length, 0)
    assert.equal((await api.selectUserSessionByContactId('Upeer')).topType, 1)
    await api.updateChatSessionStatus('Upeer')
    assert.equal((await api.selectChatSessionUser()).length, 1)
    await api.deleteChatSessionUser('Upeer')
    await api.saveOrUpdateChatSessionUserBatch4Init([{ contactId: 'Upeer', sessionId: 'session', lastMessage: 'new incoming', lastReceiveTime: 2 }])
    assert.equal((await api.selectChatSessionUser()).length, 1)
    await api.saveMessage({ messageId: 77, sessionId: 'session', messageType: 5, status: 1, fileName: 'clip.mov', fileSize: 640, fileType: 1 })
    await api.saveMessage({ messageId: 77, sessionId: 'session', messageType: 5, status: 0, fileName: 'clip.mov', fileSize: 1000, fileType: 1, filePath: '/original/clip.mov' })
    const finalFile = await api.selectChatMessagesByMessageId(77)
    assert.equal(finalFile.status, 1)
    assert.equal(finalFile.fileSize, 640)
    assert.equal(finalFile.filePath, '/original/clip.mov')
    await api.updateMessage({ status: 2 }, { messageId: 77 })
    assert.equal((await api.selectChatMessagesByMessageId(77)).status, 1)
    await Promise.all([
      api.saveMessage({ messageId: 78, clientMessageId: 'same-client-key', sessionId: 'session', messageType: 5, status: 1, fileSize: 640, fileName: 'clip.mov' }),
      api.saveMessage({ messageId: 78, clientMessageId: 'same-client-key', sessionId: 'session', messageType: 5, status: 0, fileSize: 1000, fileName: 'clip.mov' }),
    ])
    const concurrentFile = await api.selectChatMessagesByMessageId(78)
    assert.equal(concurrentFile.status, 1)
    assert.equal(concurrentFile.fileSize, 640)
    assert.equal(concurrentFile.clientMessageId, 'same-client-key')
    assert.equal(await api.queryCount('SELECT count(*) FROM chat_message WHERE message_id = 78', []), 1)
    const emitted = []
    const unreadBeforeMirror = (await api.selectUserSessionByContactId('Upeer')).noReadCount
    const sync = createDesktopMessageSync({
      userId: () => 'Utest', currentSessionId: () => null,
      findMessage: api.selectChatMessagesByMessageId, saveMessage: api.saveMessage,
      findSession: api.selectUserSessionByContactId, saveSession: api.saveOrUpdateChatSessionByMessage,
      emit: (message) => emitted.push(message)
    })
    const fileFrame = { messageId: 79, sessionId: 'session', contactId: 'Upeer', sendUserId: 'Utest', contactType: 0, fileName: 'voice.mp3', fileType: 1, messageContent: '[媒体]', sendTime: 3 }
    await sync({ ...fileFrame, messageType: 6, fileSize: 400, status: 1 })
    await sync({ ...fileFrame, messageType: 5, fileSize: 600, status: 0 })
    assert.equal((await api.selectChatMessagesByMessageId(79)).fileSize, 400)
    assert.equal((await api.selectChatMessagesByMessageId(79)).messageType, 5)
    assert.equal((await api.selectUserSessionByContactId('Upeer')).noReadCount, unreadBeforeMirror)
    assert.equal(emitted[0].fileSize, 400)
    await assert.rejects(api.queryAll('select * from missing_table', []), /no such table/)
  } finally {
    sqlite.Database = NativeDatabase
    if (database) await new Promise((resolve, reject) => database.close((error) => error ? reject(error) : resolve()))
    const absolute = path.resolve(directory)
    assert.equal(path.dirname(absolute), path.resolve(os.tmpdir()))
    assert.ok(path.basename(absolute).startsWith('wetalk-cache-test-'))
    await rm(absolute, { recursive: true, force: true })
  }
})
