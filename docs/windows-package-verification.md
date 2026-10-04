# Windows NSIS 安装包构建验收

日期：2026-10-04。最新测试包源码提交：`de22cd02250b1c374c8cfccd95727dc7a6b985c6`，构建开始时与 `origin/master` 一致、工作区干净。

本次已在HEVC处理、账号隔离、同账号多端最终消息metadata合并、申请拉黑状态修正，以及搜索结果发送消息入口接通后重建最终测试包；同时移除了图片组件中未定义的冗余点击绑定，保留外层实际预览行为。`3ff96f9`、`a5f96bd` 两个旧包稳定副本仍保留。此包只代表上面明确的源码快照，后续代码更改需另行复验，不能把本页哈希自动视为后续HEAD的产物；仅更新本页文档不会改变安装包源码快照。视频链路验收见 `hevc-processing-verification.md`。

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
- 编译后关键代码还确认包含 `createTrustedIpcMain`、`createRestrictedIpc`、被实际调用的 `createMediaProcessors` / `processOutgoingMedia`、H.264兼容的 `yuv420p`、最终消息metadata的 `mergeChatMessage`。

使用的命令窗口设置仅作用于本次命令，没有修改系统环境或源码默认值：

```cmd
set RENDERER_VITE_WETALK_SERVER_ORIGIN=
set RENDERER_VITE_WETALK_WS_ORIGIN=
set ELECTRON_BUILDER_CACHE=D:\environment\WeTalkBrowserQA\electron-builder-cache
D:\environment\Node\current\npm.cmd run build:win -- --publish never
```

打包前桌面最终全套回归106/106通过，失败0、跳过0，显式启用真实HEVC及Chromium分支。随后本次main/preload/renderer 构建、NSIS 构建、blockmap 生成均成功，最终退出码 0。npm mirror 配置和 Sass legacy API 的既有提示没有导致失败。旧安装器、blockmap 和 latest.yml 的独立稳定副本均保留；构建前重新核对两份旧安装器哈希。

## 产物

目录：`D:/codex/data/wetalk/frontend/installPackages/`。

| 文件 | 大小（字节） | SHA-256 |
|---|---:|---|
| `WeTalkAppSetup.1.0.0.exe` | 200923228 | `770f0313699acbdddb6969922cbd46a058e950903c72893bdc0b18c0b8937faa` |
| `WeTalkAppSetup.1.0.0.exe.blockmap` | 208363 | `92a677604f5c18689049ab3672df23f53f4639d04c2f810cd4a1ed6374700f76` |
| `latest.yml` | 345 | `f8376e891f9af3797266d09196015e51f6697407fe2bdf3ec31ccf1b32f1d363` |

安装器约 191.62 MiB。`latest.yml` 的文件名、大小与 SHA-512 已按实际安装器重算并逐项一致；生成该本地元数据不等于发布更新。

为避免后续构建覆盖，本次安装器另保存为 `D:/environment/WeTalkParityQA/20261004/nsis-verification/WeTalkAppSetup.1.0.0-default-local-de22cd0.exe`，并保留同名blockmap与 `latest-de22cd0.yml`。完整验证结果为同目录 `verification-de22cd0.json`，检查脚本为 `verify-package-de22cd0.cjs`；构建日志为 `build-de22cd0.log`，内嵌归档完整性与提取日志为 `archive-test-de22cd0.log` / `archive-extract-de22cd0.log`，稳定副本回读结果为 `stable-archive-de22cd0.json`。

首轮稳定副本 `WeTalkAppSetup.1.0.0-default-local-3ff96f9.exe` 保持原样；重建前重新核对其SHA-256仍为 `f48147f00c11fc393b13184f795ab6118485c82ce424926bb47d5d49079ac656`，大小200902142字节。`WeTalkAppSetup.1.0.0-default-local-a5f96bd.exe` 的SHA-256仍为 `e04d0d72fc806e7f04f84b338d0fd6ed219f4d1ce29032eafd42408069319c0e`，大小200913887字节。旧验证JSON、脚本与提取目录均保留，不能与de22结果混用。

## 实际安装器内资源验证

使用仓库依赖的 `7za.exe t` 检查安装器内嵌载荷，输出 `Everything is Ok`、退出码 0；95 个文件/22 个目录通过。7-Zip 的尾随数据提示来自带安装器外围数据的内嵌 7z 载荷，并未执行安装器。

随后仅静态提取下列资源，与 `installPackages/win-unpacked` 对应文件逐一比较 SHA-256，均一致：

| 安装器内相对路径 | 大小（字节） | SHA-256 |
|---|---:|---|
| `resources/app.asar` | 97844280 | `6f676ba410f63fd9ceb27c500c48ea6fb686a4276e7bd34e7f6e6dd640ce6358` |
| `resources/app.asar.unpacked/node_modules/sqlite3/lib/binding/napi-v6-win32-unknown-x64/node_sqlite3.node` | 1851904 | `7fb52b781709b065c240b6b81394be6e72e53fe11d7c8e0f7b49dd417eb78a01` |
| `resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg.exe` | 81114624 | `e9fd5e711debab9d680955fc1e38a2c1160fd280b144476cc3f62bc43ef49db1` |
| `resources/app.asar.unpacked/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe` | 63059968 | `4303ec85855340689b1f8aa5d9c1dc06ef3e3090682de3034edc3fca2b0798d5` |
| `resources/assets/default_avatar.png` | 437451 | `da75f4a370606ac4dbbb6879234ff4f1b7ddb04fbf3298037902ad0ee13bc71f` |

默认头像还与源码 `assets/default_avatar.png` 字节一致。ASAR 内未嵌套旧 `installPackages` 目录。包内57个main/preload/renderer编译文件与本轮 `out/` 对应文件逐字节一致，包括最终 `Search-9c6a4bcf.js` 与 `ContactApply-c22edfa0.js`。

包内主进程 `out/main/index.js` SHA-256为 `1cc63f4eeb5f63575333817577513d5c32f643081cb4e072e423a3e7c61e365c`；preload为 `4a486c59db940ddb1895b5684bcbb778838dc3e9feb944bbf52e452311996dac`。

本轮仅静态提取、检查JS及对比哈希，没有运行安装器、应用主程序或提取出的原生/媒体组件。四项资源哈希与首轮实际运行验证过的组件完全一致；首轮记录为sqlite内存库 `SELECT 42 AS answer` 返回42，以及ffmpeg 6.0生成/ffprobe 4.0.2读回16×16 PNG。这些旧组件运行记录与本轮静态包检验分别保留，不冒称重新启动过它们。

本轮未发现当前 NSIS 产物缺失所需资源的打包缺陷，因此未修改产品代码、服务器默认值或打包身份。安装向导、覆盖安装/卸载及真实用户运行验收不属于本次未安装检查的证据范围。
