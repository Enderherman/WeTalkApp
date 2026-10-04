import {
  run,
  queryOne,
  queryAll,
  queryCount,
  insert,
  insertOrUpdate,
  insertOrIgnore,
  update
} from './ADB'
import store from '../store'

/**
 * 存储单条消息
 */
const saveMessage = (chatMessage) => {
  chatMessage.userId = store.getUserId()
  //console.log('this is chatMessageModel, chatMessage: ', chatMessage, '\n')
  return insertOrUpdate('chat_message', chatMessage)
}

/**
 * 批量存储消息并更新未读消息计数
 * @param {Array} chatMessageList - 要保存的聊天消息列表
 * @returns {Promise<void>}
 */
const saveMessageBatch = async (chatMessageList) => {
  // INIT already contains authoritative unread counts. Hydration must not add
  // every recent message again on each reconnect.
  const savePromises = chatMessageList.map((chatMessage) => saveMessage(chatMessage))
  await Promise.all(savePromises)
}

const getPageOffset = (pageNo, totalCount) => {
  const pageSize = 20
  const pageTotal =
    totalCount % pageSize === 0 ? totalCount / pageSize : Math.floor(totalCount / pageSize) + 1
  pageNo = pageNo <= 1 ? 1 : pageNo
  pageNo = pageNo >= pageTotal ? pageTotal : pageNo
  return {
    pageTotal,
    offset: (pageNo - 1) * pageSize,
    limit: pageSize
  }
}

const selectChatMessage = async (query) => {
  return new Promise(async (resolve, reject) => {
    const { sessionId, pageNo, maxMessageId } = query
    let sql = `SELECT count(1)
               FROM chat_message
               WHERE session_id = ?
                 and user_id = ?`
    const totalCount = await queryCount(sql, [sessionId, store.getUserId()])
    const { pageTotal, offset, limit } = getPageOffset(pageNo, totalCount)
    const params = [sessionId, store.getUserId()]
    sql = `SELECT *
           FROM chat_message
           WHERE session_id = ?
             and user_id = ? `
    if (maxMessageId) {
      sql = sql + ` and message_id <= ? `
      params.push(maxMessageId)
    }
    params.push(offset)
    params.push(limit)
    sql = sql + ' order by message_id desc limit ?,? '
    console.log('-------------------------------\n run sql: ', sql, '\nparams: ', params, '\n')
    const dataList = await queryAll(sql, params)
    resolve({ dataList, pageTotal, pageNo })
  })
}

/**
 * 更新消息
 */
const updateMessage = (data, paramData) => {
  paramData.userId = store.getUserId()
  return update('chat_message', data, paramData)
}

/**
 * 查询聊天信息
 */
const selectChatMessagesByMessageId = (messageId) => {
  let sql = `SELECT *
             FROM chat_message
             WHERE message_id = ?
               and user_id = ?`
  const params = [messageId, store.getUserId()]
  return queryOne(sql, params)
}

export {
  saveMessage,
  saveMessageBatch,
  selectChatMessage,
  updateMessage,
  selectChatMessagesByMessageId
}
