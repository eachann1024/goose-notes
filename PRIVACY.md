# Privacy policy / 隐私政策

Goose Note is a local-first desktop note-taking app. It has no accounts, no analytics and no telemetry.
Your notes stay in the folders you open or in the app's local data directory.

Goose Note does not transfer your notes or other personal data to networked systems unless you specifically
request it (for example by configuring an AI provider, Git sync or error reporting). Like any desktop app, it
makes a few requests that carry no note content, only the information inherent to an HTTPS request (IP address,
user agent). All network activity is listed below.

## Automatic requests (no personal data, no note content)

| When | Destination | Purpose |
| --- | --- | --- |
| At startup and every 4 hours | `raw.githubusercontent.com` (GitHub) | Read `updates/latest.json` to show whether a newer version exists. Installers are downloaded from GitHub Releases only after you click download. Signed macOS builds also read `updates/mac-<arch>.json` for automatic updates. |
| When text uses the built-in monospace font "DM Mono" and it is not installed locally | `cdn.jsdelivr.net` | Download the font file. |
| When you choose the serif font "仓耳今楷" and it is not installed locally | `cdn.jsdmirror.com`, `cdn.jsdelivr.net`, `raw.githubusercontent.com` | Download the font file. |
| When the built-in welcome note is displayed | `goose-notion-1257312034.cos.ap-guangzhou.myqcloud.com` (Tencent Cloud COS, operated by the maintainer) | Load the welcome cover image. |

## Features that send data only when you use or configure them

- **AI chat, AI menu and agents**: the prompts and the note content you select are sent to the AI provider and
  endpoint you configure with your own API key (e.g. OpenAI, Anthropic, DeepSeek, Zhipu, MiniMax or a custom
  OpenAI-compatible endpoint). AI HTML widgets load display fonts from `assets.claude.ai`. The provider's own
  privacy policy applies.
- **Web search / fetch tools for AI**: queries and URLs are sent to TinyFish (`api.search.tinyfish.ai`,
  `api.fetch.tinyfish.ai`) only after you add a TinyFish API key.
- **Git sync**: notes are pushed to the GitHub or Gitee repository you configure; repository visibility is checked
  through the GitHub / Gitee API.
- **Export to PDF / image**: fonts, KaTeX styles, Mermaid and html-to-image are loaded from `cdn.jsdelivr.net`
  and Google Fonts (`fonts.googleapis.com`) while exporting.
- **Error reporting**: disabled by default. It is only enabled if you create `~/.config/goose/error-reporting.json`
  with `enabled: true` and your own Sentry DSN; reports then go to that DSN.
- **Remote images, videos and files in your notes**: content you embed by URL is loaded from that URL.
- **Links** (feedback form, plugin pages, search shortcuts) open in your browser only when you click them.

## Your choices

Do not configure AI, TinyFish, Git sync or error reporting if you do not want those features to send data.
Uninstalling the app removes the program; your note folders are never deleted automatically.

---

**中文摘要**：Goose Note 无账号、无统计、无遥测，笔记保存在本地。除你主动配置的 AI 服务、联网搜索、Git 同步、错误上报以及导出功能外，不会发送笔记或个人数据。自动发生、且不含笔记内容的请求只有：启动时及每 4 小时从 GitHub 读取更新信息；按需从 CDN 下载 DM Mono / 仓耳今楷字体；显示内置欢迎页时从维护者的腾讯云 COS 加载封面图。
