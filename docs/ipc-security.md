# Electron IPC 与页面隔离

2026-10-04：主窗口、管理窗口和媒体窗口均启用 `contextIsolation: true`、`nodeIntegration: false`。`sandbox` 维持 `false`，避免把此次隔离改造与既有 Node/native 依赖迁移耦合；渲染页面没有 Node `require` 或 `process`。

preload 只通过 `contextBridge` 公开 `window.ipcRenderer.send`、`invoke`、`on`。不公开原生 ipcRenderer、electronAPI、事件对象或同步/跨窗口发送方法。所有通道集中登记于 `src/shared/ipcChannels.mjs`：

- `send`：登录/窗口操作、聊天会话操作、本机文件和更新操作；通道必须属于 `sendChannels`。
- `invoke`：隐藏会话、待发队列、历史缓存、已读游标和头像处理；通道必须属于 `invokeChannels`。
- `on`：登记的业务回复/实时事件；回调第一参数为 `null`，其后为业务数据。调用 `on` 会返回可重复调用的取消订阅函数。

组件通过 `useIpcListeners` 在卸载时只清理自己的订阅。聊天和联系人共用 `receiveMessage` 时，卸载其中一个组件不再移除另一个组件的监听；文件设置页重复进入也不累积监听。

主进程再次验证注册通道和发送来源：来源必须是已登记窗口的主 frame，并且 URL 的 origin 与该窗口页面服务一致，路径仅限 `/` 或 `/index.html`。销毁窗口立即撤销其登记。未授权 `send` 不执行副作用，未授权 `invoke` 拒绝。通用本地存储读写还限制到实际页面使用的服务器配置键/当前账号端口，不能读取任意账号 token。

主/子窗口阻止外部页面导航、非页面入口跳转、跨 origin 重定向和 webview 附加；所有 `window.open` 均不创建 Electron 子窗口，只有合法 HTTP(S) 链接交给系统浏览器。媒体/管理子窗口通过受控 `newWindow` 创建，路径和管理员角色仍由主进程限制。

验证：`npm run test:ipc-security` 包含真实桥行为、未知通道拒绝、事件脱敏、独立订阅清理、页面导航/来源限制及当前 renderer 通道盘点；完整 Electron 运行验收另记录在项目审计中，不能用单元测试代替真实运行结果。
