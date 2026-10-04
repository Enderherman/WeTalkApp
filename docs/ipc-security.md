# Electron IPC 与页面隔离

本页说明当前桌面进程和窗口之间的约定。功能更新见 [CHANGELOG](../CHANGELOG.md)，安装包中对应代码的静态证据见 [Windows 核验](windows-package-verification.md)。

## 窗口与 preload

主窗口、管理窗口和媒体窗口均设置 `contextIsolation: true`、`nodeIntegration: false`。`sandbox` 仍为 `false`；不能将 context isolation 描述成已经启用 Electron sandbox。渲染页面没有 Node 的 `require` 或 `process`。

preload 通过 `contextBridge` 只公开 `window.ipcRenderer.send`、`invoke` 和 `on`。它不暴露原生 ipcRenderer、`electronAPI`、原生事件、`sendSync`、`sendTo` 或 `eventNames`。通道定义集中在 [ipcChannels.mjs](../src/shared/ipcChannels.mjs)。

| 方法                       | 约定                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `send(channel, ...args)`   | 仅允许 `sendChannels`，覆盖登录、窗口、会话、文件和更新等现有动作                          |
| `invoke(channel, ...args)` | 仅允许 `invokeChannels`，覆盖隐藏会话、待发队列、历史缓存、已读游标和头像处理              |
| `on(channel, callback)`    | 仅允许登记的业务回复/实时事件；回调首参固定为 `null`，其后为业务数据；返回幂等取消订阅函数 |

桥实现见 [restrictedIpc.mjs](../src/preload/restrictedIpc.mjs)。组件使用 [useIpcListeners](../src/renderer/src/composables/useIpcListeners.js) 在卸载时清理自身订阅；一个组件离开不能移除另一个组件对相同事件的监听。

## 主进程来源校验

主进程再次检查通道与发送者。消息来源必须同时满足：窗口已登记、frame 是该窗口主 frame、URL origin 与登记页面服务一致、路径为 `/` 或 `/index.html`。窗口销毁时撤销登记。未经授权的 `send` 不执行副作用，`invoke` 拒绝请求。

通用本地存储访问限制为实际页面所需的服务器配置键和当前账号端口，不能任意读取其他账号 token。受控子窗口入口仍检查路径与管理员角色，页面路由限制不能代替主进程校验。

## 页面导航

主窗口和子窗口阻止外部导航、非入口路径、跨 origin 重定向及 webview 附加。`window.open` 不创建 Electron 窗口；通过协议检查的 HTTP(S) 链接可交给系统浏览器。管理与媒体窗口通过受控 `newWindow` 创建，使用与主窗口一致的可信页面 origin。

来源和导航约束见 [windowSecurity.mjs](../src/main/utils/windowSecurity.mjs)。

## 验证范围

```cmd
npm run test:ipc-security
```

该组 5 项回归覆盖桥行为、未知通道拒绝、事件脱敏、独立订阅清理、窗口来源与导航限制，并盘点当前 renderer 实际使用的通道。

2026-10-04 的真实 Electron 验收在 `8a41ed0` 快照完成 15/15，包含原生主/媒体窗口和桥行为；后续 `a5f96bd` 的真实多端流程见[跨端同步](multi-device-message-sync.md)。工作区运行记录为 `D:/codex/data/wetalk/audit/desktop-runtime.md`，属于本地审计材料，未作为本仓库文件发布。

最终 `de22cd0` 安装包静态确认隔离 preload、`contextIsolation: true`、`createTrustedIpcMain` 与 `createRestrictedIpc` 存在。静态检查证明包内代码对应源码，不等同于已启动最终打包应用。
