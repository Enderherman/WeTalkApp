# WeTalkApp

## 完整历史搜索与定位（2026-10-04）

- “记录”入口可搜索当前或全部会话的服务器完整历史，支持消息正文/附件名、关键词高亮和逐页进度；可停止检索。
- 选择结果会加载连续历史并定位原消息；无权限/已移除会话明确提示结果不完整，避免把部分扫描当完整结果。
- `npm run test:history-search` 3 项回归覆盖多会话全部分页、取消/陈旧结果和异常分页终止。

## 文字幂等重试与离线发送（2026-10-04）

- 每条文字消息先保存到按账号隔离的 SQLite 待发队列，再携带稳定 `clientMessageId` 发送；断线重连自动顺序重放，超时重试沿用原键。
- 聊天显示待发/发送中/失败状态，支持手动重试和取消发送；应用重开可恢复未完成草稿，退出账号后陈旧响应不会进入新账号。
- 发送控件防重复提交，并避开中文输入法组合态的 Enter；只有本地保存成功才清空输入。
- `npm run test:outbox` 7 项回归覆盖重放、失败顺序、重启恢复、账号退出及实际 SQLite 持久化。

## AI 停止生成与状态展示（2026-10-04）

- AI 思考/生成中可停止，停止失败保留原回复并允许重试；采用服务器返回的完成/停止/失败状态并写回缓存。
- 流式内容在生成时即可显示，不再被骨架屏遮挡；历史机器人消息同样恢复终态。
- `npm run test:ai` 8 项状态、停止 API 和实际 Vue 模板回归通过。

## 持久已读与私聊回执（2026-10-04）

- 可见且聚焦的聊天会话将已读游标提交到后端并落本地缓存；后台、失焦和切去联系人/设置时不误报已读。
- 游标只前进不回退，提交失败在重新连接/聚焦后重试；私聊发送气泡根据对端回执显示“已读”。
- `npm run test:read-cursor` 3 项回归及 SQLite 新/旧库游标测试通过。

## 服务器历史分页（2026-10-04）

- 桌面聊天打开会话和上翻时读取服务器游标历史，换电脑也能加载更早记录；结果同步到按账号隔离的 SQLite 缓存。
- 断网时回退本地缓存并提供重载提示；切换会话会丢弃旧请求结果，服务器/缓存/实时消息按 ID 去重排序。
- `npm run test:history` 3 项回归验证分页游标、终止条件、陈旧请求隔离和本地文件路径保留。

## 登录设备管理（2026-10-04）

- 设置新增“登录设备”：显示设备名称、类别、登录时间/最近活动和当前设备，支持刷新、撤销其他单设备及退出全部其他设备。
- 当前设备通过原有退出登录入口退出；失败保留设备列表并显示重试提示，防止重复提交。
- `npm run test:devices` 3 项回归覆盖目标设备撤销/刷新、当前设备保护、失败及重复提交。

## 联系人备注与缓存迁移（2026-10-04）

- 好友详情支持设置/清空备注（去除首尾空白，最多 40 字符）；联系人、会话标题、列表和搜索优先显示备注，并保留真实昵称。
- 私有 type 18 事件同步同一账号其他端的备注，不创建消息或增加未读；SQLite 新旧库迁移保留备注和已读游标。
- 登录等待 SQLite 初始化，修复回调 `this` 失效与错误 SQL 被吞掉的问题。
- `npm run test:contact-remark` 10 项回归包含真实 SQLite 新库与旧库迁移、备注清空、名称保留和事件隔离。

## 更新包下载修复（2026-10-04）

- 更新包保存到独立临时目录，验证完整字节后通过系统打开安装程序；失败可重试，JSON 错误响应不会保存为安装包。
- 修正下载进度事件名和事件参数；更新外链仅允许 HTTP/HTTPS。
- `npm run test:update-download` 2 项回归覆盖真实本地下载、长度不匹配、错误响应、非法路径和外链协议；测试不启动真实安装程序。

## 聊天文本与搜索修复（2026-10-04）

- 聊天、AI 回复、会话摘要和搜索结果统一以文本节点展示；支持后端遗留换行/实体格式，消息和昵称里的 HTML 不再被执行。
- 搜索高亮按字面匹配，`[`、`(`、`*` 等字符不会导致正则异常，支持大小写无关匹配。
- `npm run test:message-text` 4 项测试包含真实聊天和搜索 Vue 模板的服务端渲染验证。

## 文件上传与失败重试（2026-10-04）

- 上传完成状态等待后端返回成功；HTTP/业务错误会显示“上传失败”，可使用同一条消息重新上传，避免重复创建附件消息。
- 上传完成后若已切换账号，不再改写新账号的消息；文件数量控件与图片/视频/普通文件大小按具体设置字段校验，音频无视频轨时不强制生成封面。
- `npm run test:file-upload` 的 3 项回归验证真实本地 HTTP 延迟响应、业务拒绝、失败重试及账号切换。

## 实时消息可靠性修复（2026-10-04）

- 文件和群系统消息保存到 SQLite 时保留原类型；AI 累计片段按到达顺序更新同一条消息，并保存结束/停止/失败状态。
- 重复推送、AI 片段与重新连接的 INIT 不再重复增加未读；type 17 已读回执独立处理并保存对端游标。
- 每条连接只保留一个心跳和重连定时器，退出/切换账号/退出程序时清理；旧连接和排队回调不再更新新连接。
- `npm run test:realtime` 覆盖 10 个实际消息处理/生命周期场景。此切片尚未实现桌面主动提交已读、完整服务器历史、AI 停止按钮等后续功能；不代表真实 Electron 端到端验收完成。

## 本轮功能：联系人邮箱与昵称搜索（2026-09-29）

- 添加联系人可使用邮箱精确找人，也支持用户昵称和群昵称模糊搜索；多个匹配项会以列表显示并可逐个选择。
- 桌面端通过后端 `/contact/searchByKeyword`，与 WeTalkWeb 使用同一套结果和关系状态。
- 验证：后端 Maven `clean verify` 106 项通过，WeTalkWeb 265 项单测/类型检查/生产构建通过，WeTalkApp 生产构建通过。

## NAS API 与 WebSocket 接入

设置 `RENDERER_VITE_WETALK_SERVER_ORIGIN` 和 `RENDERER_VITE_WETALK_WS_ORIGIN` 后再构建，即可把桌面客户端指向 NAS。打包版启动一个只绑定 `127.0.0.1` 临时端口的本地服务：它提供渲染页面并把 `/api` 请求按流转发到配置的后端 origin，因此渲染页保持同源且继续启用 Electron `webSecurity`。WebSocket 由 Electron 主进程直接连接配置的 NAS 地址；管理员子窗口也复用同一个本地页面 origin。

运行本地代理单测：

```cmd
npm run test:api-proxy
```

设置 `WETALK_SERVER_ORIGIN` 后，同一组用例还会请求真实后端 readiness 接口；测试不会创建账号或发送注册邮件。

2026-09-28 NAS 目标 Windows 包 `installPackages/WeTalkAppSetup.1.0.0.exe` 构建通过。为适配 N-API 稳定 ABI，`sqlite3` 原生文件在安装包中解包到 `app.asar.unpacked`；单独的内存库查询在 Node 和 Electron Node 运行时都通过。此内测包尚未完成真实账号登录与机器人聊天流程验收。

SQLite 原生绑定检查：

```cmd
npm run test:sqlite-binding
set ELECTRON_RUN_AS_NODE=1&&node_modules\electron\dist\electron.exe --test tests\sqliteBinding.test.mjs
```

WeTalkApp 是 WeTalk 的 Electron 桌面客户端，使用 Vue 3、Vite、Pinia 和 Element Plus 构建。它通过 HTTP API 和 WebSocket 连接 wetalk 后端，并使用 Electron main/preload 提供本地文件、SQLite 缓存和桌面窗口能力。

GitHub 仓库：[Enderherman/WeTalkApp](https://github.com/Enderherman/WeTalkApp)

## 环境要求

- Node.js 与 npm
- Windows、macOS 或 Linux 桌面环境
- 可访问的 wetalk 后端及其 MySQL、Redis 服务

## 安装依赖

```bash
npm install
```

## 本地开发

```bash
npm run dev
```

默认 API 和 WebSocket 指向本机后端 `127.0.0.1:5050` / `127.0.0.1:5051`。使用 NAS Docker 后端时，把 Electron 客户端指向 NAS Web 同源代理（后端端口只绑定 NAS 回环地址）：

```cmd
set RENDERER_VITE_WETALK_SERVER_ORIGIN=http://<NAS-Web地址>:8081
set RENDERER_VITE_WETALK_WS_ORIGIN=ws://<NAS-Web地址>:8081/ws
npm run dev
```

打包前在同一命令窗口设置相同变量，再运行 `npm run build:win`、`npm run build:mac` 或 `npm run build:linux`。这两个变量会编译进安装包；API 地址填写 origin，不要追加 `/api`。本机 `.env` 文件会被 Git 忽略。浏览器版 WeTalkWeb 是独立客户端，不通过 Electron 启动。

## 账号注册与 AI

注册使用邮箱验证码：先完成图片验证码并请求邮件验证码，再填写邮件中的 6 位验证码创建账号。App 不保存 SMTP 或 DeepSeek 凭据；邮箱发送和 AI 提供商均由共享 WeTalk 后端配置，AI 使用 DeepSeek 时由后端读取私有环境变量。AI 文本流的累计片段和结束状态由桌面聊天页合并到同一条机器人消息。

## 构建桌面安装包

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

当前 npm 包名为 wetalk-app，桌面产品显示名为 WeTalkApp。本次未调整 Electron appId。package.json 与 electron-builder.yml 目前配置的 appId 不同；下次发布安装包前应确认实际生效值，并评估已安装版本的升级兼容性。
