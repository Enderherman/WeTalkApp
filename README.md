# WeTalkApp

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
