# HEVC 处理与账号隔离验证

本页记录生产媒体链路及 2026-10-04 的生成媒体验证。实现由 [fileOperation.js](../src/main/fileOperation.js) 实际调用 [processOutgoingMedia](../src/main/utils/outgoingMedia.mjs) 和 [createMediaProcessors](../src/main/utils/mediaProcessing.mjs)。更新历史见 [CHANGELOG](../CHANGELOG.md)。

## 生产处理链路

1. 调用开始时固定账号、token、缓存根目录和服务器 origin，一次读取该账号消息的原始文件名与时间。
2. 在固定账号目录内使用 UUID 临时文件处理。HEVC 通过 libx264 转为 H.264/yuv420p；MP4/MOV 使用 faststart。包含视频流时生成 PNG 封面，纯音频不生成封面。
3. 处理完整成功后才将临时文件替换到正式缓存，上传保留用户原文件名并使用处理后的实际字节和 MIME。
4. 每个异步阶段检查账号/token 是否仍一致；变更后停止后续处理和上传。失败清理本次临时文件，保留原有完整缓存。

## 固定生成样本

验证使用私有生成的 64×48、10 fps、1 秒 HEVC MP4，转码与过滤均限制单线程。没有使用摄像头、真实用户媒体或硬件编码。

| 项目       | 实测结果                                                                              |
| ---------- | ------------------------------------------------------------------------------------- |
| 输入       | HEVC / yuv420p / 64×48 / 1.000 秒 / 4589 字节                                         |
| 输出       | H.264 / yuv420p / 64×48 / 1.000 秒 / 3169 字节                                        |
| 封面       | PNG / RGB24 / 170×128 / 23569 字节                                                    |
| 上传原名   | `original-user-video.mp4`                                                             |
| 最终元数据 | `messageId=42, fileName=original-user-video.mp4, fileSize=3169, fileType=1, status=1` |
| 上传 MIME  | 主文件 `video/mp4`，封面 `image/png`                                                  |
| 字节核对   | 实际 multipart HTTP 接收的主文件和封面与缓存逐字节一致，源文件保持不变                |
| 播放       | ffmpeg 完整解码成功；真实 Chromium 返回 64×48、`duration=1`、`readyState=4`           |

| 文件 | SHA-256                                                            |
| ---- | ------------------------------------------------------------------ |
| 输入 | `3ed4b2140d15ea56fea895dbdaf3d51040fd30a4d4d315e02a7d4d38dc8836d4` |
| 输出 | `d8d3536597d2fb5a0a011573902d7af9c0266c22b00b880968076a70eb3f78c9` |
| 封面 | `55f000efd927c8b8da3381dc2ec31851f261a77fd0638f0243d8856cda2a21d8` |

本地证据目录为 `D:/environment/WeTalkParityQA/20261004/hevc-verification/`，保存 `pipeline-result.json`、`source-hevc.mp4`、`output-h264.mp4` 和 `cover.png`。该接收器核对上传体及最终元数据；Spring/MySQL 持久化与真实跨端分发由[多端运行验收](multi-device-message-sync.md)独立证明。

## 账号边界证据

旧实现的对照复现使用实际 `fileOperation.js`，只替换账号、数据库和上传边界：账号 A 的第一条消息查询等待时切换为 B，旧函数随后重新读取账号，将 A 的生成测试文件复制到 B 的 `202610/99.txt`。

当前实现对同一场景只读取一次消息并报告账号变更，A/B 缓存均无写入。另有回归覆盖探测编码期间切号、转码失败保留缓存、纯音频跳过封面。对照证据分别为同目录 `old-account-reproduction.json` 和 `fixed-account-verification.json`，均使用生成数据。

## 重跑方法

```cmd
node --test tests/outgoingMedia.test.mjs tests/avatarCover.test.mjs tests/localMediaServer.test.mjs tests/cachedUploadFile.test.mjs tests/fileUpload.test.mjs
```

真实 Chromium 分支需要 Playwright 包和已安装浏览器。下列是本机既有验证环境的路径，其他机器需替换成各自路径：

```cmd
set WETALK_PLAYWRIGHT_PACKAGE=D:/environment/WeTalkBrowserQA/node_modules/playwright
set PLAYWRIGHT_BROWSERS_PATH=D:/environment/WeTalkBrowserQA/browsers
node --test tests/outgoingMedia.test.mjs tests/avatarCover.test.mjs tests/localMediaServer.test.mjs tests/cachedUploadFile.test.mjs tests/fileUpload.test.mjs
```

可选设置 `WETALK_HEVC_EVIDENCE_DIR` 保存生成证据。该组已完成的验证结果为 **22 通过、0 跳过**，实际使用生产函数、已安装 ffmpeg、本地 multipart HTTP 和 Chromium。最终桌面全套测试在源码 `de22cd0` 上达到 **106 通过、0 失败、0 跳过**，命令与构建证据见[安装包核验](windows-package-verification.md)。

这些结果证明指定生成样本及所列异常路径，不承诺任意容器/编码均可播放。最终 NSIS 内的生产调用、`yuv420p` 和编译文件做过静态检查；安装器及打包应用主程序未运行。
