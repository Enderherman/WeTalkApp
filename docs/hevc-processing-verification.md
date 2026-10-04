# HEVC 转码、封面和账号隔离验收

2026-10-04。使用私有生成的64×48、10fps、1秒HEVC MP4；生成、H.264转码和缩略图处理均限制单线程/单过滤线程，未使用摄像头、真实用户媒体、硬件编码或安装程序。

## 真实生产链路

`fileOperation.saveFileToLocal` 现在调用导出的 `processOutgoingMedia`；它与 `createMediaProcessors` 被下面的自动化直接使用，验证的不是另写的一套转码命令替身。

1. 固定开始时账号、token、缓存目录、服务器origin，一次读取该账号消息的原始文件名和时间。
2. 在该账号缓存目录中使用UUID临时文件处理。HEVC用libx264、yuv420p转码，MP4/MOV补faststart；有视频流时生成PNG封面，只有音频流时跳过封面。
3. 全部处理成功后才将完整临时文件替换到目标缓存，上传使用原文件名及处理后的真实字节。失败清理临时文件，转码失败不会删掉原有完整缓存。
4. 各异步阶段检查账号/token是否仍一致；变更后停止后续处理/上传。不会在第二次查询路径时读取新账号的缓存目录。

## 已复现的旧问题

使用实际旧 `fileOperation.js` 在内存中转换为可加载模块，只替换账号、数据库和上传边界：第一条账号A消息查询尚未返回时切换到B。旧函数随后第二次读账号数据，确实将A的测试文件复制到B的 `202610/99.txt`。

同一场景对新实现再次执行：只读取一次消息，抛出账号变更错误，A/B缓存均没有写入。另有回归覆盖探测编码期间切号、转码失败不覆盖原缓存、音频不生成封面。

前后证据位于 `D:/environment/WeTalkParityQA/20261004/hevc-verification/old-account-reproduction.json` 与 `fixed-account-verification.json`。均为生成的测试数据，不涉及用户资料。

## 转码和上传结果

| 项目 | 实测结果 |
|---|---|
| 输入 | HEVC / yuv420p / 64×48 / 1.000秒 / 4589字节 |
| 输出 | H.264 / yuv420p / 64×48 / 1.000秒 / 3169字节 |
| 封面 | PNG / RGB24 / 170×128 / 23569字节 |
| 上传原名 | `original-user-video.mp4`，没有变成缓存编号名 |
| HTTP中最终文件metadata | `messageId=42, fileName=original-user-video.mp4, fileSize=3169, fileType=1, status=1` |
| 上传MIME | `video/mp4`，封面为 `image/png` |
| 上传字节 | 真HTTP multipart收到的主文件/封面与实际缓存逐字节一致 |
| 原文件 | SHA-256未变化 |
| 解码 | ffmpeg完整解码成功；真实Chromium读到64×48、duration=1、readyState=4 |

- 输入SHA-256：`3ed4b2140d15ea56fea895dbdaf3d51040fd30a4d4d315e02a7d4d38dc8836d4`
- 输出SHA-256：`d8d3536597d2fb5a0a011573902d7af9c0266c22b00b880968076a70eb3f78c9`
- 封面SHA-256：`55f000efd927c8b8da3381dc2ec31851f261a77fd0638f0243d8856cda2a21d8`

真实函数+ffmpeg+本地multipart HTTP+Chromium链路的结果在同目录 `pipeline-result.json`，并保留 `source-hevc.mp4`、`output-h264.mp4`、`cover.png`。该HTTP验收接收器验证上传体和最终metadata，未把它冒充成Spring/MySQL持久化或多端WebSocket验收；服务端type6与同账号另一端metadata合并由对应集成验收覆盖。

## 回归和重跑

`node --test tests/outgoingMedia.test.mjs tests/avatarCover.test.mjs tests/localMediaServer.test.mjs tests/cachedUploadFile.test.mjs tests/fileUpload.test.mjs` 共22项通过、无跳过；实际Chromium分支在设置 `WETALK_PLAYWRIGHT_PACKAGE` 与 `PLAYWRIGHT_BROWSERS_PATH` 后执行。`WETALK_HEVC_EVIDENCE_DIR` 可选指定生成证据的目录。`npm run build` 验证main/preload/renderer。

既有NSIS安装器 `f48147f0…` 只对应源码 `3ff96f9`，不包含本次视频处理与账号隔离修改。最终安装包应在后续代码收敛后重新构建并记录新哈希；本轮没有运行或安装旧包。
