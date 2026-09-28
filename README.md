# WeTalkApp

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

开发环境 API 与 WebSocket 地址在应用配置中设置。浏览器版 WeTalkWeb 是独立客户端，不通过 Electron 启动。

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
