# Windows 1.0.0 测试包核验

核验日期：2026-10-04。最终测试包的产品源码为 `de22cd02250b1c374c8cfccd95727dc7a6b985c6`，构建开始时与 `origin/master` 一致且工作区干净。此后的文档提交不会改变这个产物对应的源码快照。

本页保存构建输入和可复核证据。功能变化集中在 [CHANGELOG](../CHANGELOG.md)，媒体处理见 [HEVC 验证](hevc-processing-verification.md)。

## 验证范围

已完成源码测试、main/preload/renderer 构建、完整 NSIS 构建、内嵌归档完整性检查、静态提取和资源字节比对。**安装器未运行、应用未安装、最终打包的主程序未启动；未发布 GitHub Release，未部署 NAS。** 正式域名仍未配置。

当前产物使用仓库默认本机 API/WS 地址，是 `1.0.0` 内测包。生成本地 `latest.yml` 不表示已发布更新。安装向导、覆盖安装、卸载及最终安装后运行不在本页证据范围。

## 生效配置与源码验证

| 项目                               | 实际值                                                             |
| ---------------------------------- | ------------------------------------------------------------------ |
| 命令                               | `npm run build:win -- --publish never`                             |
| 脚本展开                           | `npm run build && electron-builder --win --config --publish never` |
| 配置来源                           | 构建日志为 `package.json ("build" field)`                          |
| appId                              | `com.easychat`                                                     |
| 包名 / 产品名 / 版本               | `wetalk-app` / `WeTalkApp` / `1.0.0`                               |
| 目标                               | Windows x64 / NSIS，`oneClick=false`、`perMachine=false`           |
| Node / Electron / electron-builder | `24.14.0` / `25.9.8` / `24.13.3`                                   |
| 签名                               | 未配置；安装器 PE 证书表长度为 0                                   |

当前 `build:win` 的裸 `--config` 实际选择 [package.json](../package.json) 中的 build 字段。显式指定 [electron-builder.yml](../electron-builder.yml) 属于另一入口，其 appId 是 `com.electron.app`。目录包组件验收使用过 YAML 入口，最终 NSIS 使用 package.json 入口；两者的配置和安装身份不能混用。本次未改动任何 appId。

构建前没有 `.env` / `.env.production`，进程中未设置 renderer 后端变量。产物使用：

- API：`http://127.0.0.1:5050`。
- WebSocket：`ws://127.0.0.1:5051/ws`。
- renderer：仅绑定 loopback 的临时页面服务，`/api` 代理到上述 API。

对应构建命令仅在该命令窗口生效：

```cmd
set RENDERER_VITE_WETALK_SERVER_ORIGIN=
set RENDERER_VITE_WETALK_WS_ORIGIN=
set ELECTRON_BUILDER_CACHE=D:\environment\WeTalkBrowserQA\electron-builder-cache
D:\environment\Node\current\npm.cmd run build:win -- --publish never
```

打包前在 `de22cd0` 执行以下桌面全套回归，结果为 **106 通过、0 失败、0 跳过**，显式启用真实 HEVC 和 Chromium 分支；生产构建成功：

```cmd
set WETALK_PLAYWRIGHT_PACKAGE=D:/environment/WeTalkBrowserQA/node_modules/playwright
set PLAYWRIGHT_BROWSERS_PATH=D:/environment/WeTalkBrowserQA/browsers
node --test tests/*.test.mjs
npm run build
```

这 106 项结果来自当时的命令输出和审计记录，没有另存独立全套测试日志。后续 NSIS、blockmap 构建退出码为 0，Sass legacy API 等既有提示未导致失败。

## 最终产物

常规输出目录为 `D:/codex/data/wetalk/frontend/installPackages/`，可能被后续构建覆盖，应优先核对下述稳定副本。

| 输出文件                            |    字节数 | SHA-256                                                            |
| ----------------------------------- | --------: | ------------------------------------------------------------------ |
| `WeTalkAppSetup.1.0.0.exe`          | 200923228 | `770f0313699acbdddb6969922cbd46a058e950903c72893bdc0b18c0b8937faa` |
| `WeTalkAppSetup.1.0.0.exe.blockmap` |    208363 | `92a677604f5c18689049ab3672df23f53f4639d04c2f810cd4a1ed6374700f76` |
| `latest.yml`                        |       345 | `f8376e891f9af3797266d09196015e51f6697407fe2bdf3ec31ccf1b32f1d363` |

安装器约 191.62 MiB；`latest.yml` 的文件名、大小和 SHA-512 已依据实际安装器重算并一致。

稳定证据根目录：`D:/environment/WeTalkParityQA/20261004/nsis-verification/`。

| 文件                                                      | 用途               |
| --------------------------------------------------------- | ------------------ |
| `WeTalkAppSetup.1.0.0-default-local-de22cd0.exe`          | 最终安装器稳定副本 |
| `WeTalkAppSetup.1.0.0-default-local-de22cd0.exe.blockmap` | 对应 blockmap      |
| `latest-de22cd0.yml`                                      | 对应本地更新元数据 |
| `verification-de22cd0.json`                               | 结构化核验结果     |
| `verify-package-de22cd0.cjs`                              | 核验脚本           |
| `build-de22cd0.log`                                       | 构建日志           |
| `archive-test-de22cd0.log`、`archive-extract-de22cd0.log` | 归档检查及提取日志 |
| `stable-archive-de22cd0.json`                             | 稳定副本回读结果   |

上述文件是本机审计材料，不在 Git 仓库中。

## 实际安装器资源

`7za t` 检查内嵌载荷得到 `Everything is Ok`、退出码 0，覆盖 95 个文件和 22 个目录。内嵌 7z 载荷的尾随数据提示来自安装器外围数据，该步骤没有执行安装器。

静态提取后，以下资源与 `installPackages/win-unpacked` 对应文件 SHA-256 一致：

| 安装器内路径                                                                                               |   字节数 | SHA-256                                                            |
| ---------------------------------------------------------------------------------------------------------- | -------: | ------------------------------------------------------------------ |
| `resources/app.asar`                                                                                       | 97844280 | `6f676ba410f63fd9ceb27c500c48ea6fb686a4276e7bd34e7f6e6dd640ce6358` |
| `resources/app.asar.unpacked/node_modules/sqlite3/lib/binding/napi-v6-win32-unknown-x64/node_sqlite3.node` |  1851904 | `7fb52b781709b065c240b6b81394be6e72e53fe11d7c8e0f7b49dd417eb78a01` |
| `resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg.exe`                                        | 81114624 | `e9fd5e711debab9d680955fc1e38a2c1160fd280b144476cc3f62bc43ef49db1` |
| `resources/app.asar.unpacked/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe`                        | 63059968 | `4303ec85855340689b1f8aa5d9c1dc06ef3e3090682de3034edc3fca2b0798d5` |
| `resources/assets/default_avatar.png`                                                                      |   437451 | `da75f4a370606ac4dbbb6879234ff4f1b7ddb04fbf3298037902ad0ee13bc71f` |

默认头像与源码 `assets/default_avatar.png` 字节一致，ASAR 内未嵌套旧 `installPackages`。包内 **57 个** main/preload/renderer 编译文件与本次 `out/` 逐字节一致，包含 `Search-9c6a4bcf.js` 和 `ContactApply-c22edfa0.js`。

| 编译文件            | SHA-256                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `out/main/index.js` | `1cc63f4eeb5f63575333817577513d5c32f643081cb4e072e423a3e7c61e365c` |
| preload             | `4a486c59db940ddb1895b5684bcbb778838dc3e9feb944bbf52e452311996dac` |

实际提取代码包含默认 API/WS 字面值，不含私有 QA `15060` 一组 origin；隔离 preload、`contextIsolation: true`、`createTrustedIpcMain`、`createRestrictedIpc`、实际调用的 `createMediaProcessors` / `processOutgoingMedia`、`yuv420p` 和 `mergeChatMessage` 均在包内。

SQLite、ffmpeg、ffprobe 和默认头像四项资源与此前目录包中实际验证过的字节一致。此前执行结果为 SQLite `SELECT 42 AS answer` 返回 42、ffmpeg 6.0 生成及 ffprobe 4.0.2 读回 16×16 PNG；本次最终 NSIS 核验没有重新执行这些提取出的组件。

## 同版本归档产物

以下均是 `1.0.0` 测试包，来源由提交和哈希区分，不代表不同正式版本。稳定文件均在上述证据根目录，命名为 `WeTalkAppSetup.1.0.0-default-local-<提交>.exe`；各自脚本、JSON 和提取结果保留，不能混用。

| 源码提交  |    字节数 | SHA-256                                                            |
| --------- | --------: | ------------------------------------------------------------------ |
| `3ff96f9` | 200902142 | `f48147f00c11fc393b13184f795ab6118485c82ce424926bb47d5d49079ac656` |
| `a5f96bd` | 200913887 | `e04d0d72fc806e7f04f84b338d0fd6ed219f4d1ce29032eafd42408069319c0e` |

两份归档安装器在最终重建前已重新核对哈希。最新测试产物以本页开头的 `de22cd0` 快照及完整哈希为准，不能将其认作后续源码 HEAD 的新构建。
