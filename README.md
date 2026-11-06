# BlobTrack 98 / 复古 Blob 追踪工具

Win98 风格的浏览器图像/视频 Blob 效果工具，包含液体和气泡效果。仓库由 `index.html`、`css/win98.css` 与 `js/` 脚本组成，没有 package.json 构建入口。

A Win98-style browser image/video blob-effect tool with liquid and bubble effects. The repository consists of `index.html`, `css/win98.css` and `js/` scripts, with no package.json build entry.

## 本地查看 / Local preview

在仓库根目录运行以下命令，再打开 http://localhost:8000 。需要 Python；此服务仅供本地预览。

Run the following from the repository root, then open http://localhost:8000. Python is required; this server is for local preview only.

```sh
python -m http.server 8000 --bind 127.0.0.1
```

界面提供图片/视频打开、图片粘贴、摄像头、示例、预设、PNG 导出、整段视频导出及定时录制入口。摄像头和媒体能力取决于浏览器支持与用户授权。Ctrl+O 打开，Ctrl+S 导出 PNG，空格播放/暂停。

The interface exposes image/video opening, image paste, camera input, demo, presets, PNG/video export and timed recording. Camera/media availability depends on browser support and user permission. Ctrl+O opens a file; Ctrl+S exports PNG; Space toggles playback.

## 验证边界 / Verification boundary

本说明基于仓库文件与界面声明的静态检查；本次双语整理未重新执行浏览器、摄像头或导出测试，也未修改应用代码。

This documentation is based on static inspection of repository files and declared UI actions. This bilingual maintenance did not rerun browser, camera or export tests and did not modify application code.
