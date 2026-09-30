# PDF 中文字体

不再内置 Noto Sans SC。构建不会下载或拷贝 `public/fonts` 里的 otf/ttf，避免 8MB 打进 dist。

Electron 主进程使用隐藏窗口 `printToPDF`，采用系统中文字体栈，不嵌入此文件。

浏览器 / printToPDF 失败时的 react-pdf 降级：首次导出从钉版本 CDN 拉 **Noto Sans SC static TTF**（不要 WOFF2 / OTF），同会话内存缓存后转 data URL 再 `Font.register`。失败则明确报错，不假装 Helvetica/Inter 成功。

- 主源：`https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@5.2.8/chinese-simplified-400-normal.ttf`
- 备用：`https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@5.1.0/chinese-simplified-400-normal.ttf`

打包后的 `file://` 页面不能把字体 src 设成站点根 `/fonts/...`（会变成 `file:///fonts/...`）。

> 仅 PDF 导出的 react-pdf 降级依赖此字体；Markdown / HTML / DOCX / PNG 导出不受影响。
