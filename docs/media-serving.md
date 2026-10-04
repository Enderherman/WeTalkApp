# 桌面本地媒体服务

2026-10-04。保留 renderer 使用的 `/file?partType=avatar|chat|tmp&fileId=...&fileType=0|1|2&showCover=true|false&forceGet=true|false`，修复本地文件展示与播放的 HTTP 边界。

## 行为

- 服务显式只监听 `127.0.0.1`；登录先设置当前账号目录，再等待监听成功。重复登录/关闭按顺序关闭旧服务及旧连接，监听失败交给登录流程处理。
- 校验模块、文件类型、布尔参数、重复参数与文件编号。聊天附件必须能从当前账号的消息记录查询到，文件路径由消息编号和安全扩展名组成。
- 文件限定在当前账号缓存根目录；校验实际路径，拒绝目录穿越、绝对路径参数及指向其他目录的符号链接/Windows junction。
- 仅受信任的本地 renderer Origin 返回 CORS 许可，不再使用 `Access-Control-Allow-Origin: *`。普通图片无 Origin 请求继续可用；远程 Origin 拒绝。
- GET/HEAD 返回正确 Content-Length、Accept-Ranges 和媒体类型；音频不再统一误标为 video/mp4。头像按实际图片签名识别 MIME，兼容后端以 `.png` 缓存名保存 JPEG。
- 单范围支持 `bytes=start-end`、`bytes=start-`、`bytes=-suffix`。有效范围 206；越界、倒序、格式错误、多范围或零长度文件上的 Range 为 416，包含 `Content-Range: bytes */size`。
- 缺参数400、无文件404、无当前会话401；异步数据库/文件失败返回有限 JSON，不泄漏本地路径或 SQL，不悬挂请求。开始输出后的流错误终止连接。
- 下载先写随机临时文件，流完整完成且账号未切换后才替换缓存。中断或错误删除临时文件，保留已有缓存；相同文件并发下载合并。JSON 错误支持带 charset 的 Content-Type；仅缺失头像使用默认图，不把聊天业务错误保存成伪附件。
- 默认头像资源位置改用 Electron `process.resourcesPath`，避免将可执行文件路径误当目录。

## 验证

运行 `node --test tests/localMediaServer.test.mjs`，7 项测试通过，使用真实 loopback HTTP 和 multipart 上游，覆盖完整/HEAD/Range字节、空文件416、端口占用、参数/Origin拒绝、异步失败、Windows junction、并发下载、切换账号、JSON错误、传输中断与旧缓存保留。连同原有上传与更新下载测试共12项通过。测试只创建独立临时目录并在核对路径后清理。

另运行桌面 `npm run build` 验证 main/preload/renderer；现有 Sass legacy API 和较大 chunk 提示不影响成功构建。此验证不等同于安装包中真实用户媒体播放，实体桌面窗口流程由集成验收补充。
