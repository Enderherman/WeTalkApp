# WeTalkApp

WeTalkApp 是 WeTalk 的 Electron 桌面客户端，使用 Vue 3、Vite、Pinia 和 Element Plus。客户端通过共享后端的 HTTP API 与 WebSocket 同步聊天，在本机按账号保存 SQLite 缓存、待发文字和媒体文件。

仓库：[Enderherman/WeTalkApp](https://github.com/Enderherman/WeTalkApp)。浏览器客户端 [WeTalkWeb](https://github.com/Enderherman/WeTalkWeb) 是独立项目。

当前包版本为 `1.0.0`。已核验的 Windows 安装包是默认本机后端目标的测试产物，未发布 GitHub Release、未安装或运行该安装包、未部署到 NAS；正式域名尚未配置。源码快照与产物哈希见[安装包核验](docs/windows-package-verification.md)，版本更新统一记录在 [CHANGELOG.md](CHANGELOG.md)。

## 当前功能

| 范围       | 能力                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| 账号       | 邮箱验证码注册、登录、资料与头像、修改密码、退出；查看登录设备、撤销指定其他设备或退出全部其他设备             |
| 联系人     | ID、邮箱和昵称搜索；好友申请、同意、拒绝、拉黑；备注、删除和黑名单；已有好友或已加入群可从搜索结果进入聊天     |
| 群聊       | 创建与编辑群资料、头像和封面、成员管理、退出与解散；按群主和管理员权限限制操作                                 |
| 会话       | 本机置顶、移除与恢复；移除保留聊天记录，新消息到达自动恢复；服务器历史分页与本机断网缓存                       |
| 消息       | 文字、文件、图片、音频、视频；当前或全部会话完整历史搜索、附件名检索、高亮和原消息定位                         |
| 同步与发送 | 同账号镜像、去重、附件完成状态、已读游标与私聊回执；文字持久待发队列、重连重放、失败重试或取消；附件原消息重试 |
| AI         | 累计流式回复、思考与生成状态、停止生成、完成/停止/失败状态缓存                                                 |
| 管理       | 用户和群管理、系统配额与机器人设置、靓号、版本草稿及灰度/公开发布管理界面                                      |
| 桌面       | 文件选择、拖入与粘贴，媒体预览和下载，本地目录设置，托盘和窗口控制，更新包下载                                 |

聊天文本以文本节点渲染，搜索按字面匹配。已读只在聊天页面可见且窗口聚焦时提交；本人消息镜像和文件完成通知不增加未读。

## 环境与安装

需要 Node.js、npm 和可访问的 WeTalk 后端。MySQL、Redis、SMTP 和 AI 提供商凭据由后端管理，桌面不保存 SMTP 或 AI 密钥。已核验的 Windows 环境使用 Node.js `24.14.0`、Electron `25.9.8` 和 electron-builder `24.13.3`；实际依赖版本以锁文件为准。

```cmd
npm install
npm run dev
```

依赖安装会执行 `electron-builder install-app-deps`；ffmpeg-static 也需要运行安装脚本下载二进制。Vite 开发页面端口为 `5000`。当前 `dev` 脚本包含 Windows 的 `chcp` 命令；仓库提供 macOS/Linux 打包脚本，但本文的运行与安装包证据仅覆盖 Windows。

注册流程为图片验证码、邮件中的 6 位验证码和账号资料。邮件投递与机器人可用性依赖共享后端配置。

## 连接后端

| 构建变量                             | 默认值                   | 格式                                   |
| ------------------------------------ | ------------------------ | -------------------------------------- |
| `RENDERER_VITE_WETALK_SERVER_ORIGIN` | `http://127.0.0.1:5050`  | HTTP(S) origin，不带 `/api` 或其他路径 |
| `RENDERER_VITE_WETALK_WS_ORIGIN`     | `ws://127.0.0.1:5051/ws` | 完整 WebSocket URL                     |

只配置 API origin 时，从该 origin 推导 `ws://` 或 `wss://` 地址并追加 `/ws`。使用 NAS 同源代理时，在同一个命令窗口设置变量再开发或构建：

```cmd
set RENDERER_VITE_WETALK_SERVER_ORIGIN=http://<NAS-Web地址>:8081
set RENDERER_VITE_WETALK_WS_ORIGIN=ws://<NAS-Web地址>:8081/ws
npm run dev
```

这些值在构建时写入产物，修改环境变量后需要重新构建。`.env`、`.env.*`、`node_modules/`、`out/`、`installPackages/` 和日志均不提交 Git。

打包版及已构建预览启动仅绑定 `127.0.0.1` 临时端口的页面服务，将 `/api` 流式代理到目标后端。主窗口与管理、媒体子窗口共用可信 renderer origin；WebSocket 由主进程直接连接目标地址。存在真实 Vite 开发服务器时才跳过本地页面服务。

## 开发、验证与构建

```cmd
npm run build
npm start
```

`build` 生成 main、preload 和 renderer，`start` 预览已构建结果。常用专项检查如下，全部命令见 [package.json](package.json)：

| 范围                   | 命令                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 页面代理、SQLite       | `npm run test:api-proxy`、`npm run test:sqlite-binding`                                                            |
| 消息与待发队列         | `npm run test:realtime`、`npm run test:message-mirror`、`npm run test:outbox`                                      |
| 历史、搜索、已读、AI   | `npm run test:history`、`npm run test:history-search`、`npm run test:read-cursor`、`npm run test:ai`               |
| 登录、设备、联系人、群 | `npm run test:session`、`npm run test:devices`、`npm run test:contact-remark`、`npm run test:group-members`        |
| 可见搜索和申请入口     | `npm run test:contact-search-actions`、`npm run test:contact-apply-actions`                                        |
| 隔离、上传与设置       | `npm run test:ipc-security`、`npm run test:file-upload`、`npm run test:upload-validation`、`npm run test:settings` |

完整桌面测试：

```cmd
node --test tests/*.test.mjs
```

真实 Chromium 媒体验证需可用的 Playwright 包与浏览器，变量及命令见 [HEVC 验证](docs/hevc-processing-verification.md)。`test:api-proxy` 默认检查本地代理；显式设置 `WETALK_SERVER_ORIGIN` 才增加真实后端 readiness 检查，该检查不注册账号或发送邮件。

生成 Windows 本地测试包：

```cmd
npm run build:win -- --publish never
```

产物写入 `installPackages/`。该脚本实际读取 `package.json` 的 `build` 字段，appId 为 `com.easychat`；显式指定 `electron-builder.yml` 是另一入口，appId 为 `com.electron.app`。发布或升级前需按[安装包核验](docs/windows-package-verification.md)核对配置入口与安装身份。

## 已验证基线

2026-10-04 在产品源码 `de22cd02250b1c374c8cfccd95727dc7a6b985c6` 上，桌面完整测试 **106 通过、0 失败、0 跳过**，显式执行真实 HEVC 和 Chromium 分支，生产构建成功。该结果属于已完成的源码验证，文档重写没有重新运行整套功能测试。

真实同账号 Web/Electron 消息、文件和 AI 镜像验收使用 `a5f96bd`；最终 `de22cd0` 安装包完成静态提取、资源哈希和 57 个编译文件逐字节比对。这些证据不覆盖安装、覆盖升级或卸载。

## 文档导航

| 文档                                                       | 内容                                    |
| ---------------------------------------------------------- | --------------------------------------- |
| [更新日志](CHANGELOG.md)                                   | 对应版本的功能、修复和文档变化          |
| [IPC 与页面隔离](docs/ipc-security.md)                     | preload 白名单、窗口来源和订阅生命周期  |
| [本地媒体服务](docs/media-serving.md)                      | 文件路径、Range、缓存、上传名与大小限制 |
| [跨端消息同步](docs/multi-device-message-sync.md)          | 镜像、完成事件、SQLite 合并和待发确认   |
| [HEVC 处理验证](docs/hevc-processing-verification.md)      | 生产处理链路、账号隔离和生成媒体证据    |
| [Windows 安装包核验](docs/windows-package-verification.md) | 生效配置、源码快照、产物哈希和验证边界  |
