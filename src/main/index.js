import { app, shell, BrowserWindow, Menu, Tray } from 'electron'

import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import {
  onLoginOrRegister,
  onLoginSuccess,
  winTitleOp,
  onSetLocalStore,
  onGetLocalStore,
  onLoadChatSession,
  onDeleteChatSession,
  onTopChatSession,
  onLoadChatMessage,
  onAddChatMessage,
  onSetSessionSelect,
  onCreateCover,
  onOpenNewWindow,
  onSaveAs,
  onSaveClipBoardFile,
  onLoadContactApply,
  onClearContactApplyCount,
  onLoginOut,
  onOpenLocalFolder,
  onGetSysSetting,
  onChangeLocalFolder,
  onReloadChatSession,
  onOpenUrl,
  onDownloadUpdate,
  onLoadLocalUser,
  openWindow
} from './ipc'
import { saveWindow } from './windowProxy'
import store from './store'
import { ensureAppDirectories } from './utils/platformUtils'
import { startDesktopApiServer } from './utils/desktopApiServer.mjs'
import { setDesktopRendererOrigin } from './utils/desktopRendererOrigin'
import { closeWs } from './wsClient'
import { externalHttpUrl } from './utils/updateDownload.mjs'

let desktopApiServer = null
const hasDevRenderer = is.dev && Boolean(process.env['ELECTRON_RENDERER_URL'])

// 禁用 DNS over HTTPS
app.commandLine.appendSwitch('disable-features', 'DnsOverHttps')

//打开控制台
// const NODE_ENV = process.env.NODE_ENV
// if (NODE_ENV === 'development') {
//   mainWindow.webContents.openDevTools();
// }

const login_width = 300
const login_height = 370
const register_height = 550

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    title: '微语',
    width: login_width,
    height: login_height,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    resizable: false,
    frame: true,
    transparent: true,
    ...(process.platform === 'linux' ? { icon } : { icon }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: false
    }
  })

  saveWindow('main', mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    mainWindow.setTitle('微语')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    const url = externalHttpUrl(details.url)
    if (url) shell.openExternal(url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (hasDevRenderer) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else if (desktopApiServer) {
    mainWindow.loadURL(`${desktopApiServer.origin}/index.html`)
  } else {
    app.quit()
    return
  }

  //增加托盘
  const tray = new Tray(icon)
  const contextMenu = [
    {
      label: '退出微语',
      click: function () {
        app.exit(0)
      }
    }
  ]
  const menu = Menu.buildFromTemplate(contextMenu)
  const defaultTrayMenu = [...contextMenu]
  tray.setToolTip('微语')
  tray.setContextMenu(menu)
  tray.on('click', () => {
    mainWindow.setSkipTaskbar(false)
    mainWindow.show()
  })

  //监听 登录注册
  onLoginOrRegister((isLogin) => {
    console.log('callBack方法' + isLogin)
    mainWindow.setResizable(true)
    if (isLogin) {
      mainWindow.setSize(login_width, login_height)
    } else {
      mainWindow.setSize(login_width, register_height)
    }
    mainWindow.setResizable(false)
  })

  //登录成功
  onLoginSuccess((config) => {
    contextMenu.splice(0, contextMenu.length, ...defaultTrayMenu)
    mainWindow.setResizable(true)
    mainWindow.setSize(850, 800)
    //居中显示
    mainWindow.center()
    //最大化
    mainWindow.setMaximizable(true)
    //最小的窗口大小
    mainWindow.setMinimumSize(800, 600)
    if (config.admin) {
      //管理员新界面,托盘操作
      contextMenu.unshift({
        label: '管理后台',
        click: function () {
          openWindow({
            windowId: 'admin',
            title: '管理后台',
            path: '/admin',
            width: config.screenWidth * 0.75,
            height: config.screenHeight * 0.75,
            data: {
              token: config.token
            }
          })
        }
      })
    }
    //展示用户信息
    contextMenu.unshift({
      label: '用户:' + config.nickName,
      click: function () {}
    })
    tray.setContextMenu(Menu.buildFromTemplate(contextMenu))
  })

  //顶部操作按钮
  winTitleOp((e, { action, data }) => {
    //1.获取当前窗口
    const webContents = e.sender
    const win = BrowserWindow.fromWebContents(webContents)
    switch (action) {
      case 'close': {
        if (data.closeType === 0) {
          win.close()
        } else {
          //设置关闭窗口隐藏到任务栏
          win.setSkipTaskbar(true)
          win.hide()
        }
        break
      }
      case 'minimize': {
        win.minimize()
        break
      }
      // 在index.js中
      case 'maximize': {
        // 保存当前窗口大小和位置
        const bounds = win.getBounds()
        store.setUserData('previousBounds', bounds)

        // 获取屏幕尺寸并填满
        const { width, height } = require('electron').screen.getPrimaryDisplay().workAreaSize
        win.setBounds({ x: 0, y: 0, width, height })
        break
      }

      case 'unmaximize': {
        // 恢复到之前保存的窗口大小和位置
        const previousBounds = store.getUserData('previousBounds')
        if (previousBounds) {
          win.setBounds(previousBounds)
        }
        break
      }

      case 'top': {
        win.setAlwaysOnTop(data.top)
        break
      }
    }
  })

  onSetLocalStore()

  onGetLocalStore()

  onLoadChatSession()

  onDeleteChatSession()

  onTopChatSession()

  onLoadChatMessage()

  onAddChatMessage()

  onSetSessionSelect()

  onCreateCover()

  onOpenNewWindow()

  onSaveAs()

  onSaveClipBoardFile()

  onLoadContactApply()

  onClearContactApplyCount()

  onLoginOut(() => {
    contextMenu.splice(0, contextMenu.length, ...defaultTrayMenu)
    tray.setContextMenu(Menu.buildFromTemplate(contextMenu))
    mainWindow.setResizable(true)
    mainWindow.setMinimumSize(login_width, login_height)
    mainWindow.setSize(login_width, login_height)
    mainWindow.center()
    mainWindow.setResizable(false)
    mainWindow.setSkipTaskbar(false)
    mainWindow.show()
  })

  onOpenLocalFolder()

  onGetSysSetting()

  onChangeLocalFolder()

  onReloadChatSession()

  onOpenUrl()

  onDownloadUpdate()

  onLoadLocalUser()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 确保应用目录结构
  ensureAppDirectories()

  if (!hasDevRenderer) {
    try {
      desktopApiServer = await startDesktopApiServer({
        apiOrigin: import.meta.env.RENDERER_VITE_WETALK_SERVER_ORIGIN || 'http://127.0.0.1:5050',
        rendererDirectory: join(__dirname, '../renderer')
      })
      setDesktopRendererOrigin(desktopApiServer.origin)
    } catch {
      console.error('WeTalk 本地服务启动失败')
      app.quit()
      return
    }
  }

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  closeWs()
  if (desktopApiServer) {
    void desktopApiServer.close()
    desktopApiServer = null
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
