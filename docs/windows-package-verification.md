# Windows NSIS 安装包构建验收

日期：2026-10-04。源码提交：`3ff96f92d7e82d34c394b245a21abeb14b1a5d82`，构建开始时与 `origin/master` 一致、工作区干净。

本次完成完整 NSIS 安装包构建和静态资源/字节验证。**没有运行安装器、安装应用、打开打包后的 WeTalkApp.exe、发布 Release 或部署 NAS。** 这是仓库默认本机目标的构建验收产物；正式域名及 NAS 发布入口仍留待整体功能完成后确定。

## 构建输入与有效配置

| 项目 | 实际值 |
|---|---|
| 脚本 | `npm run build:win -- --publish never` |
| 实际展开 | `npm run build && electron-builder --win --config --publish never` |
| 配置来源 | 日志明确为 `package.json ("build" field)` |
| appId | `com.easychat`，保持现有脚本的安装标识 |
| package / product / version | `wetalk-app` / `WeTalkApp` / `1.0.0` |
| 目标 | Windows x64 / NSIS，`oneClick=false`，`perMachine=false` |
| Node / Electron / electron-builder | `24.14.0` / `25.9.8` / `24.13.3` |
| 签名 | 本轮未配置签名；安装器 PE 证书表长度为 0 |

当前 `build:win` 的裸 `--config` 实际选择 package.json 的 build 字段。此前媒体检查明确指定 `--config electron-builder.yml`，属于另一入口；该 YAML 的 appId 是 `com.electron.app`。本轮没有切换配置入口或修改任一 appId，避免把构建验收变成安装身份迁移。

构建前检查未发现 `.env` / `.env.production`，进程中也未设置 `RENDERER_VITE_WETALK_SERVER_ORIGIN` 或 `RENDERER_VITE_WETALK_WS_ORIGIN`。采用当前源码默认值：

- API：`http://127.0.0.1:5050`，来源为 `src/main/index.js` 与 `src/renderer/src/utils/Api.js` 的回退值。
- WebSocket：`ws://127.0.0.1:5051/ws`，来源为 renderer API 配置的回退值，交给主进程连接。
- 打包版 renderer 仍由只绑定 loopback 的临时本地页面服务提供，`/api` 代理到上述 API 地址。
- 从实际安装器提取 `resources/app.asar` 后，检查了编译后的 main/renderer：默认 API/WS 字面值存在，私有 QA `15060` 一组 origin 不存在；隔离 preload 和 `contextIsolation: true` 仍在包内。

使用的命令窗口设置仅作用于本次命令，没有修改系统环境或源码默认值：

```cmd
set RENDERER_VITE_WETALK_SERVER_ORIGIN=
set RENDERER_VITE_WETALK_WS_ORIGIN=
set ELECTRON_BUILDER_CACHE=D:\environment\WeTalkBrowserQA\electron-builder-cache
D:\environment\Node\current\npm.cmd run build:win -- --publish never
```

main/preload/renderer 构建、NSIS 构建、blockmap 生成均成功，最终退出码 0。npm mirror 配置和 Sass legacy API 的既有提示没有导致失败。构建前已将旧安装器、blockmap 和 latest.yml 复制到本机独立验证目录，未删除旧备份。

## 产物

目录：`D:/codex/data/wetalk/frontend/installPackages/`。

| 文件 | 大小（字节） | SHA-256 |
|---|---:|---|
| `WeTalkAppSetup.1.0.0.exe` | 200902142 | `f48147f00c11fc393b13184f795ab6118485c82ce424926bb47d5d49079ac656` |
| `WeTalkAppSetup.1.0.0.exe.blockmap` | 207894 | `33ca690b9191e62bd1a7340d90e27125cade26e182f17e2aaeb67adc42c69d09` |
| `latest.yml` | 345 | `7dfaa9e76f30f8be6dab635eec608ce11b6ea8f198fd9d3a8a7773b373156189` |

安装器约 191.60 MiB。`latest.yml` 的文件名、大小与 SHA-512 已按实际安装器重算并逐项一致；生成该本地元数据不等于发布更新。

为避免后续构建覆盖，本次安装器另保存为 `D:/environment/WeTalkParityQA/20261004/nsis-verification/WeTalkAppSetup.1.0.0-default-local-3ff96f9.exe`。完整验证结果为同目录 `verification.json`，检查脚本为 `verify-package.cjs`。

## 实际安装器内资源验证

使用仓库依赖的 `7za.exe t` 检查安装器内嵌载荷，输出 `Everything is Ok`、退出码 0；95 个文件/22 个目录通过。7-Zip 的尾随数据提示来自带安装器外围数据的内嵌 7z 载荷，并未执行安装器。

随后仅静态提取下列资源，与 `installPackages/win-unpacked` 对应文件逐一比较 SHA-256，均一致：

| 安装器内相对路径 | 大小（字节） | SHA-256 |
|---|---:|---|
| `resources/app.asar` | 97781101 | `e440aa54f8f564335c22e49fe8c9472f333b2745d965e39251911b6ee0864e3e` |
| `resources/app.asar.unpacked/node_modules/sqlite3/lib/binding/napi-v6-win32-unknown-x64/node_sqlite3.node` | 1851904 | `7fb52b781709b065c240b6b81394be6e72e53fe11d7c8e0f7b49dd417eb78a01` |
| `resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg.exe` | 81114624 | `e9fd5e711debab9d680955fc1e38a2c1160fd280b144476cc3f62bc43ef49db1` |
| `resources/app.asar.unpacked/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe` | 63059968 | `4303ec85855340689b1f8aa5d9c1dc06ef3e3090682de3034edc3fca2b0798d5` |
| `resources/assets/default_avatar.png` | 437451 | `da75f4a370606ac4dbbb6879234ff4f1b7ddb04fbf3298037902ad0ee13bc71f` |

默认头像还与源码 `assets/default_avatar.png` 字节一致。ASAR 内未嵌套旧 `installPackages` 目录。

资源可用性另作独立检查：从安装器提取的 sqlite N-API 模块在 Node 24 中打开内存库，`SELECT 42 AS answer` 返回 42；提取的 ffmpeg 6.0 生成 16×16 PNG，提取的 ffprobe 4.0.2 读回 `codec_name=png, width=16, height=16`。仅执行了这些媒体/数据库组件验证，没有启动安装器或应用主程序。

本轮未发现当前 NSIS 产物缺失所需资源的打包缺陷，因此未修改产品代码、服务器默认值或打包身份。安装向导、覆盖安装/卸载及真实用户运行验收不属于本次未安装检查的证据范围。
