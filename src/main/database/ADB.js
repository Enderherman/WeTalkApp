const fs = require('fs')
const sqlite3 = require('sqlite3').verbose()
const os = require('os')
const NODE_ENV = process.env.NODE_ENV
import { add_table, add_index, alter_table } from './Table'

const userDir = os.homedir()
console.log(userDir)
const dbFolder = userDir + (NODE_ENV === 'development' ? '/.weTalkDev/' : '/.weTalk/')
console.log(dbFolder)

if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder)
}

//创建数据库
const db = new sqlite3.Database(dbFolder + 'local.db')

//全局映射关系
const globalColumnMap = {}
/**
 * 创建并初始化数据库表和索引
 *
 * 此函数执行以下操作：
 * 1. 创建所有必要的表结构
 * 2. 添加所有必要的索引
 * 3. 检查并修改表结构（如添加缺失的 fileId 列）
 *
 * @returns {Promise<void>} 返回一个 Promise，当所有数据库操作完成时解析
 */
const createTable = async () => {
  try {
    // 创建表结构
    for (const table of add_table) {
      await run(table, [])
    }

    // 旧版 user_setting 表把 server_port 建成了 server 列，迁移已有用户数据库。
    const userSettingColumns = await queryAll('pragma table_info(user_setting)', [])
    const hasServerPort = userSettingColumns.some((column) => column.name === 'server_port')
    const hasLegacyServer = userSettingColumns.some((column) => column.name === 'server')
    if (!hasServerPort && hasLegacyServer) {
      await run('alter table user_setting rename column server to server_port', [])
    } else if (!hasServerPort) {
      await run('alter table user_setting add column server_port integer', [])
    }

    // 创建索引
    const sessionColumns = await queryAll('pragma table_info(chat_session_user)', [])
    const messageColumns = await queryAll('pragma table_info(chat_message)', [])
    if (!messageColumns.some((item) => item.name === 'client_message_id')) {
      await run('alter table chat_message add column client_message_id varchar', [])
    }
    if (!sessionColumns.some((item) => item.name === 'remark')) {
      await run('alter table chat_session_user add column remark varchar(40)', [])
    }
    for (const column of ['last_read_message_id', 'peer_read_message_id']) {
      if (!sessionColumns.some((item) => item.name === column)) {
        await run(`alter table chat_session_user add column ${column} integer default 0`, [])
      }
    }

    // 创建索引
    for (const index of add_index) {
      await run(index, [])
    }

    // 修改表结构（如有必要）
    for (const item of alter_table) {
      const fileIdList = await queryAll(`pragma table_info(${item.tableName})`, [])
      const fileIdExists = fileIdList.some((row) => row.name === 'fileId')

      if (!fileIdExists && item.sql) {
        await run(item.sql, [])
      }
    }
    return Promise.resolve()
  } catch (error) {
    return Promise.reject(error)
  }
}

/**
 * 初始化数据库中所有表的表列的全局映射。
 *
 * 此函数检索 SQLite 数据库中所有表的列表，
 * 排除内部 'sqlite_sequence' 表，并创建映射
 * 每个表的列名。列名转换为 camelCase
 * 并存储在全局可访问的对象中。
 *
 * 该功能执行以下步骤：
 * -查询数据库中的所有表名。
 * -使用 `pragma table_info` 查询遍历每个表以检索其列信息。
 * -将列名映射到其 camelCase 等效项，并将其存储在全局可访问的对象中。
 * -记录表列的全局映射。
 *
 * 此映射稍后可用于更容易的列名引用和转换。
 * @async
 * @function initTableColumnsMap
 * @returns {Promise<void>} 初始化全局列映射时解析的Promise。
 */
const initTableColumnsMap = async () => {
  let sql = `select name
             from sqlite_master
             where type = 'table'
               and name != 'sqlite_sequence'`
  let tables = await queryAll(sql, [])
  for (let i = 0; i < tables.length; i++) {
    sql = 'pragma table_info(' + tables[i].name + ')'
    let columns = await queryAll(sql, [])
    const columnMapItem = {}
    for (let j = 0; j < columns.length; j++) {
      columnMapItem[toCamelCase(columns[j].name)] = columns[j].name
    }
    globalColumnMap[tables[i].name] = columnMapItem
  }
  //console.log(globalColumnMap)
}

/**
 * 执行预期从数据库返回单个记录的SQL查询。
 * 使用提供的SQL语句和参数执行查询。
 * 在解析之前，将检索到的数据库对象转换为业务对象格式。
 *
 * @param {string} sql - 要执行的sql查询字符串。
 * @param {Object} params - 绑定到SQL查询的参数。
 * @returns {Promise<Object>} 一个解析为表示查询结果的对象的Promise。
 * 如果在执行过程中发生错误或查询没有结果，则解析为空对象。
 */
const queryOne = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err)
        return
      }
      resolve(convertDbObj2BizObj(row))
    })
  })
}

/**
 * 使用指定参数执行给定的SQL查询并检索特定计数。
 * 如果在执行过程中发生错误，则解析为0。
 *
 * @param {string} sql - 要执行的sql查询。
 * @param {Array} params - 要在SQL查询中使用的参数。
 * @returns {Promise<number>} 一个Promise，解析为从查询中检索到的计数，如果发生错误，则解析为0。
 */
const queryCount = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err)
        return
      }
      resolve(Array.from(Object.values(row))[0])
    })
  })
}

/**
 * 使用指定的参数执行提供的SQL查询，并检索所有行作为结果。
 * 生成的行在返回之前使用转换函数进行转换。
 *
 * @param {string} sql - 要执行的sql查询字符串。
 * @param {Array} params - 绑定到SQL查询的参数数组。
 * @returns {Promise<Array>} 一个Promise，解析为从数据库中检索到的转换行数组。
 */
const queryAll = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err)
        return
      }
      rows.forEach((item, index) => {
        rows[index] = convertDbObj2BizObj(item)
      })
      resolve(rows)
    })
  })
}

/**
 * 通过将数据库对象的键转换为驼峰大小写，将其转换为业务对象。
 *
 * 此函数接受通常表示数据库模式或类似结构中的数据的输入对象，
 * 并将其键转换为驼峰大小写，使用转换后的键创建一个新对象。
 *
 * @param {Object|null} data - 包含要转换的属性的输入对象。如果输入为 null 或未定义，则返回 null。
 * @return {Object|null} 一个新对象，其键转换为驼峰大小写，如果输入为假，则返回 null。
 */
const convertDbObj2BizObj = (data) => {
  if (!data) {
    return null
  }
  const bizData = {}
  for (let item in data) {
    bizData[toCamelCase(item)] = data[item]
  }
  return bizData
}

/**
 * 转驼峰
 */
const toCamelCase = (str) => {
  return str.replace(/_([a-z])/g, function (all, letter) {
    return String.fromCharCode(letter.toUpperCase().charCodeAt(0))
  })
}

/**
 * 使用提供的参数执行SQL命令，并返回异步操作的Promise
 *
 * @param {string} sql - 要执行的sql查询
 * @param {Object|Array} params - 要绑定到 SQL 查询的参数。可以是对象或数组。
 * @returns {Promise} 一个 Promise ，解析为对数据库所做的更改数量，或者在操作失败时返回错误消息
 */
const run = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err)
        return
      }
      resolve(this.changes)
    })
  })
}

/**
 *构造并执行具有指定参数的 SQL INSERT 语句。
 *
 * @param {string} sqlPrefix - SQL查询的前导段，通常包含 "INSERT INTO" 等关键字。
 * @param {string} tableName - 将插入数据的目标数据库表的名称。
 * @param{Object} data - 一个对象，包含表示列名的键值对及其要插入表中的相应值。
 * @returns {*} 使用提供的数据执行构造的SQL语句的结果。
 *
 * 此函数将输入数据映射到全局列映射中定义的相应数据库列。它构造一个SQL查询字符串，动态生成值的占位符，并使用准备好的语句绑定提供的数据以防止SQL注入。
 */
const insert = (sqlPrefix, tableName, data) => {
  const columnsMap = globalColumnMap[tableName]
  const dbColumns = []
  const params = []
  for (let item in data) {
    if (data[item] !== undefined && columnsMap[item] !== undefined) {
      dbColumns.push(columnsMap[item])
      params.push(data[item])
    }
  }
  const prepare = '?'.repeat(dbColumns.length).split('').join(',')
  const sql = `${sqlPrefix}  ${tableName} (${dbColumns.join(',')}) VALUES (${prepare})`
  return run(sql, params)
}

/**
 * 插入或者更新表
 */
const insertOrUpdate = (tableName, data) => {
  return insert('INSERT OR REPLACE INTO ', tableName, data)
}
/**
 * 插入或忽略
 */
const insertOrIgnore = (tableName, data) => {
  return insert(`INSERT OR IGNORE INTO `, tableName, data)
}

/**
 * 根据提供的数据和条件更新指定数据库表中的记录。
 *
 * @param {String} tableName -  要更新的数据库表的名称。
 * @param {Object} data - 一个包含要更新的列值对的对象。只有全局列映射中定义的列才会被更新。
 * @param {Object} paramData - 一个包含列值对的对象，用作更新查询的条件参数。只有全局列映射中定义的列才会在条件中使用。
 *@returns {Promise} 一个根据更新操作的结果解析的Promise。
 */
const update = (tableName, data, paramData) => {
  const columnsMap = globalColumnMap[tableName]
  const dbColumns = []
  const params = []
  const whereColumns = []
  for (let item in data) {
    if (data[item] !== undefined && columnsMap[item] !== undefined) {
      dbColumns.push(`${columnsMap[item]} = ?`)
      params.push(data[item])
    }
  }
  for (let item in paramData) {
    if (paramData[item]) {
      params.push(paramData[item])
      whereColumns.push(`${columnsMap[item]} = ?`)
    }
  }
  const sql = `update ${tableName}
               set ${dbColumns.join(',')} ${whereColumns.length > 0 ? 'where ' + whereColumns.join(' and ') : ''} `
  return run(sql, params)
}

const databaseReady = (async () => {
  await createTable()
  await initTableColumnsMap()
})()
export { databaseReady, run, queryOne, queryAll, queryCount, insert, insertOrUpdate, insertOrIgnore, update }
