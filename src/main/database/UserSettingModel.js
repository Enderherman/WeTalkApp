import { run, queryOne, insertOrIgnore, update, queryAll } from './ADB'
import store from '../store'
import { startLocalServer } from '../fileOperation'
import path from 'path'

const os = require('os')

const userDir = os.homedir()

/**
 * 服务器提供一个端口给使用来渲染图片 server_port的作用 不同的端口
 */
/**
 * 更新好友申请数量
 */
const updateContactApplyNoReadCount = (unreadCount, replace = false) => {
  if (replace) {
    return run('UPDATE user_setting SET contact_no_read = ? WHERE user_id = ?', [unreadCount, store.getUserId()])
  }
  let sql
  if (unreadCount) {
    sql = `UPDATE user_setting
           SET contact_no_read = contact_no_read + ?
           WHERE user_id = ?`
  } else {
    sql = `UPDATE user_setting
           SET contact_no_read = 0
           where user_id = ?`
    return run(sql, [store.getUserId()])
  }
  return run(sql, [unreadCount, store.getUserId()])
}

/**
 * 增加用户配置
 */
const addUserSetting = async (userId, email) => {
  let serverPortSelectSql = `SELECT max(server_port) as server_port
                             FROM user_setting `
  let { serverPort } = await queryOne(serverPortSelectSql, [])
  if (serverPort === null) {
    serverPort = 10240
  } else {
    serverPort += 1
  }
  const systemSettingInfo = {
    localFileFolder: path.join(userDir, '.weTalk', 'fileStorage') + path.sep
  }
  let sql = 'select * from user_setting where user_id = ?'
  const userInfo = await queryOne(sql, [userId])
  let resultServerPort
  let localFileFolder
  if (userInfo) {
    //增加更新功能
    //    await update('user_setting', { email: email }, { userId: userId })
    resultServerPort = userInfo.serverPort
    const savedSettings = userInfo.sysSetting ? JSON.parse(userInfo.sysSetting) : systemSettingInfo
    localFileFolder = path.join(savedSettings.localFileFolder || systemSettingInfo.localFileFolder, userId)
  } else {
    await insertOrIgnore('user_setting', {
      userId: userId,
      email: email,
      sysSetting: JSON.stringify(systemSettingInfo),
      contactNoRead: 0,
      serverPort: serverPort
    })
    resultServerPort = serverPort
    localFileFolder = path.join(systemSettingInfo.localFileFolder, userId)
  }
  //启动本地服务
  startLocalServer(resultServerPort)
  store.setUserData('localServerPort', resultServerPort)
  store.setUserData('localFileFolder', localFileFolder)
}

/**
 * 查询用户配置
 */
const selectSettingInfo = () => {
  let sql = `SELECT *
             from user_setting
             where user_id = ?`
  return queryOne(sql, [store.getUserId()])
}

/**
 * 更新用户配置
 */
const updateSysSetting = (sysSetting) => {
  const data = {
    sysSetting
  }
  const paramData = {
    userId: store.getUserId()
  }
  return update('user_setting', data, paramData)
}

/**
 * 加载用户
 */
const loadLocalUser = () => {
  let sql = `SELECT email
             from user_setting
             where email is not null`
  return queryAll(sql, [])
}

export {
  updateContactApplyNoReadCount,
  addUserSetting,
  selectSettingInfo,
  updateSysSetting,
  loadLocalUser
}
