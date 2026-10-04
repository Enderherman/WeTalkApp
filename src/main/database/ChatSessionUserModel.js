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

const selectChatSessionUser = () => {
  let sql = `SELECT *
             FROM chat_session_user
             WHERE user_id = ?
               and status = 1`
  return queryAll(sql, [store.getUserId()])
}

const addChatSessionUser = (sessionInfo) => {
  sessionInfo.userId = store.getUserId()
  return insertOrIgnore('chat_session_user', sessionInfo)
}

const updateChatSessionUser = (sessionInfo) => {
  const paramData = {
    userId: store.getUserId(),
    contactId: sessionInfo.contactId
  }
  const updateInfo = Object.assign({}, sessionInfo)
  delete updateInfo.userId
  delete updateInfo.contactId
  return update('chat_session_user', updateInfo, paramData)
}

/**
 * 批量保存或更新聊天会话用户信息
 * 根据contactId判断会话是否存在，存在则更新，不存在则添加
 *
 * @param {Array} chatSessionList - 需要保存或更新的聊天会话列表
 * @returns {Promise<void>} 处理完成的Promise
 */
const saveOrUpdateChatSessionUserBatch4Init = async (chatSessionList) => {
  try {
    // 准备所有会话处理操作
    const sessionPromises = chatSessionList.map(async (sessionInfo) => {
      // 设置会话状态为有效
      sessionInfo.status = 1
      // 检查会话是否已存在
      const existingSession = await selectUserSessionByContactId(sessionInfo.contactId)
      // 根据是否存在决定更新或添加
      if (existingSession) {
        return updateChatSessionUser(sessionInfo)
      } else {
        return addChatSessionUser(sessionInfo)
      }
    })
    // 并行处理所有会话
    await Promise.all(sessionPromises)
    return Promise.resolve()
  } catch (error) {
    console.error('处理聊天会话批量操作时出错:', error)
    return Promise.resolve() // 保持原有行为，但添加了错误日志
  }
}

/**
 * 更新未读消息数
 */
const updateNoReadCount = (contactId, unreadCount) => {
  let sql = `UPDATE chat_session_user
             SET no_read_count = no_read_count + ?
             WHERE user_id = ?
               and contact_id = ?`
  return run(sql, [unreadCount, store.getUserId(), contactId])
}

/**
 * 清空未读消息数
 */
const clearNoReadCount = (contactId) => {
  let sql = `UPDATE chat_session_user
             SET no_read_count = 0
             WHERE user_id = ?
               and contact_id = ?`
  return run(sql, [store.getUserId(), contactId])
}

/**
 * 根据id查询会话
 */
const selectUserSessionByContactId = (contactId) => {
  let sql = `SELECT *
             FROM chat_session_user
             WHERE user_id = ?
               and contact_id = ?`
  return queryOne(sql, [store.getUserId(), contactId])
}

/**
 * 删除数据库
 */
const deleteChatSessionUser = (contactId) => {
  const paramData = {
    userId: store.getUserId(),
    contactId: contactId
  }
  const sessionInfo = {
    status: 0
  }
  return update('chat_session_user', sessionInfo, paramData)
}

/**
 * 置顶
 */
const topChatSessionUser = (contactId, topType) => {
  const paramData = {
    userId: store.getUserId(),
    contactId: contactId
  }
  const sessionInfo = {
    topType: topType
  }
  return update('chat_session_user', sessionInfo, paramData)
}

const updateChatSessionByChatMessage = async (
  currentSessionId,
  { sessionId, contactName, lastMessage, lastReceiveTime, contactId, memberCount },
  { incrementUnread = true } = {}
) => {
  const params = [lastMessage, lastReceiveTime]
  let sql = `UPDATE chat_session_user
             set last_message      = ?,
                 last_receive_time = ?,
                 status=1`
  if (contactName) {
    sql = sql + `,contact_name = ?`
    params.push(contactName)
  }
  if (memberCount !== undefined && memberCount !== null) {
    sql = sql + `,member_count = ?`
    params.push(memberCount)
  }
  //未选中增加未读数
  if (incrementUnread && sessionId !== currentSessionId) {
    sql = sql + `,no_read_count = no_read_count + 1`
  }
  sql = sql + ` WHERE user_id = ? and contact_id = ?`
  params.push(store.getUserId())
  params.push(contactId)
  return run(sql, params)
}

const readAll = (contactId) => {
  let sql = `UPDATE chat_session_user
             SET no_read_count = 0
             WHERE user_id = ?
               and contact_id = ?`
  const params = [store.getUserId(), contactId]
  return run(sql, params)
}

/**
 * 根据消息保存或更新聊天会话
 *
 * @param {string} currentSessionId - 当前活动的会话ID
 * @param {Object} sessionInfo - 会话信息对象
 * @param {string} sessionInfo.contactId - 联系人ID
 * @param {string} [sessionInfo.contactName] - 联系人名称
 * @param {string} [sessionInfo.lastMessage] - 最后一条消息内容
 * @param {string} [sessionInfo.lastReceiveTime] - 最后接收时间
 * @param {number} [sessionInfo.memberCount] - 成员数量
 * @returns {Promise<void>} - 返回一个Promise，操作完成后解析
 */
const saveOrUpdateChatSessionByMessage = async (currentSessionId, sessionInfo, options = {}) => {
  try {
    // 查询用户是否已有与该联系人的会话
    const existingSession = await selectUserSessionByContactId(sessionInfo.contactId)

    if (existingSession) {
      // 会话已存在，更新现有会话
      await updateChatSessionByChatMessage(currentSessionId, sessionInfo, options)
    } else {
      // 会话不存在，创建新会话并设置未读计数为1
      sessionInfo.noReadCount = options.incrementUnread !== false && sessionInfo.sessionId !== currentSessionId ? 1 : 0
      await addChatSessionUser(sessionInfo)
    }
  } catch (error) {
    console.error('保存或更新聊天会话失败:', error)
    throw error // 重新抛出错误以便调用者处理
  }
}

/**
 * 更新群组名称
 */
const updateGroupName = (contactId, groupName) => {
  const paramData = {
    userId: store.getUserId(),
    contactId: contactId
  }
  const sessionInfo = {
    contactName: groupName
  }
  return update('chat_session_user', sessionInfo, paramData)
}

/**
 * 更新Session状态
 */
const updateChatSessionStatus = (contactId) => {
  const paramData = {
    userId: store.getUserId(),
    contactId: contactId
  }
  const sessionInfo = {
    status: 1
  }
  return update('chat_session_user', sessionInfo, paramData)
}
const updatePeerReadMessageId = (message) => {
  const cursor = Number(message.messageId)
  if (!Number.isSafeInteger(cursor) || cursor < 1 || message.contactType === 1) return Promise.resolve()
  return run('UPDATE chat_session_user SET peer_read_message_id = MAX(COALESCE(peer_read_message_id, 0), ?) WHERE user_id = ? AND session_id = ?', [cursor, store.getUserId(), message.sessionId])
}

const updateContactRemark = (contactId, remark) => update('chat_session_user', { remark }, { userId: store.getUserId(), contactId })

export {
  updatePeerReadMessageId,
  updateContactRemark,
  saveOrUpdateChatSessionUserBatch4Init,
  updateNoReadCount,
  clearNoReadCount,
  selectUserSessionByContactId,
  selectChatSessionUser,
  deleteChatSessionUser,
  topChatSessionUser,
  updateChatSessionByChatMessage,
  readAll,
  saveOrUpdateChatSessionByMessage,
  updateGroupName,
  updateChatSessionStatus
}
