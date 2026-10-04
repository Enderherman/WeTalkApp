# 桌面本地媒体服务

桌面通过仅绑定 `127.0.0.1` 的媒体服务读取当前账号缓存。renderer 使用 `/file`；服务实现见 [localMediaServer.mjs](../src/main/utils/localMediaServer.mjs)，生产文件入口见 [fileOperation.js](../src/main/fileOperation.js)。更新历史见 [CHANGELOG](../CHANGELOG.md)。

## 请求与账号边界

```text
/file?partType=avatar|chat|tmp&fileId=...&fileType=0|1|2&showCover=true|false&forceGet=true|false
```

服务校验模块、文件类型、布尔值、重复参数和文件编号。聊天附件必须能从当前账号消息记录查询到，缓存路径由消息编号与安全扩展名组成。请求不能指定任意本机文件。

登录先固定账号目录并等待服务监听成功。重登、关闭时按顺序停止旧服务和连接，监听失败交由登录流程处理。所有文件限定在当前账号缓存根目录，真实路径校验拒绝目录穿越、绝对路径及逃逸的符号链接或 Windows junction。

只向可信 renderer Origin 返回 CORS 许可；远程 Origin 拒绝。普通图片不携带 Origin 的请求仍可使用。不配置通配 `Access-Control-Allow-Origin: *`。

## HTTP 响应

| 请求或状态      | 行为                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------- |
| GET / HEAD      | 正确返回 MIME、`Content-Length` 和 `Accept-Ranges`；HEAD 不返回文件体                           |
| 单 Range        | 支持 `bytes=start-end`、`bytes=start-`、`bytes=-suffix`，按文件边界裁剪，返回 206               |
| 无效 Range      | 越界、倒序、格式错误、多范围或零长度文件上的 Range 返回 416，并带 `Content-Range: bytes */size` |
| 无效参数        | 400                                                                                             |
| 无当前账号      | 401                                                                                             |
| 文件不可用      | 404                                                                                             |
| 数据库/文件异常 | 返回有限错误信息，不泄漏 SQL 或本机路径；已开始输出的流异常终止连接                             |

音频和视频使用各自 MIME。头像按实际图片签名识别类型，兼容后端以 `.png` 缓存名保存的 JPEG。

## 下载缓存与头像

下载写入随机临时文件，完整结束且账号未变更后才替换正式缓存。失败或中断只清理本次临时文件，保留已有完整缓存；同一文件的并发下载合并。JSON 错误响应即使带 charset 也会被识别，不能保存成附件。

缺失头像业务码 `602` 使用默认头像；普通附件的 `602` 返回 404。默认资源由 Electron `process.resourcesPath` 定位。头像转换固定调用开始时的账号目录，每次使用 UUID 临时 PNG 和封面，各阶段检查账号，成功或失败都清理本次文件。

## 上传与媒体处理

缓存名可使用消息编号，multipart 的 `filename` 始终取消息保存的原始文件名，并显式设置 `contentType`。控制字符文件名会被拒绝；`.mjpeg` 作为 JPEG 图片别名使用 `image/jpeg`，不改变用户原名。

| 类型                     | 客户端硬上限                                      |
| ------------------------ | ------------------------------------------------- |
| 聊天图片                 | 200 MiB                                           |
| 聊天音频、视频、普通文件 | 499 MiB，为后端默认 500 MB multipart 上限保留开销 |
| 头像与资料封面           | 10 MiB                                            |

聊天附件取管理员配额与硬上限中的较小值，同时检查文件名、格式/MIME 和非空内容。播放范围依赖支持的容器与编解码器，不能保证所有媒体可播放。HEVC 转码、视频封面和账号隔离详见 [HEVC 处理验证](hevc-processing-verification.md)。

媒体进程需要真实 ffmpeg/ffprobe 可执行文件，依赖安装时必须允许二进制安装脚本。运行时将位于 `.asar` 的二进制路径映射到 `.asar.unpacked`。不同 electron-builder 配置入口及最终资源核对统一见[安装包核验](windows-package-verification.md)。

## 验证方式与证据

```cmd
node --test tests/localMediaServer.test.mjs tests/avatarCover.test.mjs tests/cachedUploadFile.test.mjs tests/fileUpload.test.mjs tests/outgoingMedia.test.mjs
```

2026-10-04 已完成的媒体专项为 22 通过、无跳过，覆盖真实 loopback HTTP、HEAD/Range 字节、端口占用、Origin 与参数拒绝、Windows junction、并发下载、切号、中断、旧缓存保留、头像转换和 multipart 原名/MIME。Chromium 分支需按 [HEVC 文档](hevc-processing-verification.md)设置环境变量。

目录包的实际组件曾完成 SQLite `SELECT 42`、ffmpeg 6.0 生成与 ffprobe 4.0.2 读回 16×16 PNG；最终 NSIS 中相同资源只做静态提取和哈希比对。真实多端附件及视频播放证据见[跨端同步](multi-device-message-sync.md)。上述结果分别对应各自源码与运行范围，不构成最终安装器运行验收。
