# SignPath Foundation application — Goose Note

Copy-paste answers for the application form at <https://signpath.org/apply>.
Submitting is a manual step by the maintainer (eachann1024). Numbers below were checked on 2026-10-07; re-check them before submitting.

## Fields

**Project Name**
```
Goose Note
```

**Repository URL**
```
https://github.com/eachann1024/goose-notes
```

**Homepage URL**
```
https://github.com/eachann1024/goose-notes
```

**Download URL** (the page contains the "Code signing policy" section)
```
https://github.com/eachann1024/goose-notes/releases/latest
```

**Privacy Policy URL**
```
https://github.com/eachann1024/goose-notes/blob/main/PRIVACY.md
```

**Wikipedia URL** — leave blank.

**License**
```
MIT
```

**Tagline**
```
A local-first Markdown note-taking desktop app with quick capture and optional, user-configured AI.
```

**Description** (≤300 characters; this one is 295)
```
Goose Note is an open-source (MIT) Electron desktop app for local Markdown notes: a block editor built on BlockNote, quick-capture window, local folder sync and export. AI features are optional and use the user's own provider and API key. No accounts, no telemetry. For Windows, macOS and Linux.
```

**What will be signed / artifact type**
```
Windows NSIS installers (.exe) for x64 and ARM64, and the main application executable ("Goose Note.exe") inside them. Built by GitHub Actions from the public repository (workflow .github/workflows/desktop-build.yml) on every published release.
```

**Reputation** (factual; do not inflate)
```
Goose Note grew out of the "鹅的笔记" (Goose Note) plugin on the uTools plugin store (https://www.u-tools.cn/plugins/detail/%E9%B9%85%E7%9A%84%E7%AC%94%E8%AE%B0/), which shows 24 user ratings averaging 4.6 and roughly 3,100 users. The standalone desktop app is developed in the open at github.com/eachann1024/goose-notes with public CI builds and GitHub Releases for Windows, macOS and Linux; its git history includes contributions from more than 20 people, including the upstream projects it was merged from. The GitHub repository itself is young (created June 2026) and has few stars so far.
```

**Privacy statement** (if asked)
```
No accounts, analytics or telemetry. Notes stay local. Data is sent only to services the user configures (AI provider, Git sync, optional self-configured Sentry error reporting). Automatic requests without user data: update check against GitHub (startup and every 4 hours), on-demand font downloads from jsDelivr, and the welcome note image. Full policy: https://github.com/eachann1024/goose-notes/blob/main/PRIVACY.md
```

**Uninstallation** (if asked)
```
The Windows NSIS installer registers an uninstaller (Settings → Apps → Goose Note → Uninstall). Uninstall instructions for all platforms are in the README.
```

**Maintainer Type**
```
Individual
```

**Build System**
```
GitHub Actions
```

**First Name / Last Name / Email** — fill in yourself (the email receives the SignPath account and approval notifications).

**Company Name** — leave blank.

**Primary Discovery Channel** — your choice (for example "GitHub").

## Checkboxes

- Required: agree to the SignPath Foundation Code of Conduct (certificates may be revoked if violated).
- Required: allow SignPath to store and process personal data.
- Optional: marketing communications.

## After approval: SignPath project setup

1. In SignPath, create the project (suggested slug `goose-notes`) with the GitHub trusted build system and a signing policy (suggested slug `release-signing`, manual approval by eachann1024).
2. Create two artifact configurations. Suggested starting point (check the real file metadata in the first signing request and adjust):

   `app-exe`: the uploaded artifact is a ZIP that contains only `Goose Note.exe`
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <artifact-configuration xmlns="http://signpath.io/artifact-configuration/v1">
     <zip-file>
       <pe-file path="Goose Note.exe" product-name="Goose Note">
         <authenticode-sign />
       </pe-file>
     </zip-file>
   </artifact-configuration>
   ```

   `installer`: the uploaded artifact is a ZIP that contains only `Goose Note-<version>-<arch>-setup.exe`
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <artifact-configuration xmlns="http://signpath.io/artifact-configuration/v1">
     <zip-file>
       <pe-file path="Goose Note-*-setup.exe" product-name="Goose Note">
         <authenticode-sign />
       </pe-file>
     </zip-file>
   </artifact-configuration>
   ```
3. Create a CI user with submitter permission and generate its API token.
4. In GitHub repository settings, add:
   - Secret `SIGNPATH_API_TOKEN`: the CI user's API token.
   - Variable `SIGNPATH_ORGANIZATION_ID`: the organization ID.
   - Optional variables if your slugs differ from the defaults: `SIGNPATH_PROJECT_SLUG` (`goose-notes`), `SIGNPATH_SIGNING_POLICY_SLUG` (`release-signing`), `SIGNPATH_APP_ARTIFACT_CONFIGURATION_SLUG` (`app-exe`), `SIGNPATH_INSTALLER_ARTIFACT_CONFIGURATION_SLUG` (`installer`).
5. Run **Desktop installers** manually on `main`. Each Windows architecture submits two signing requests (app exe, then installer), and each needs your approval in SignPath (4 per release; the jobs wait up to 60 minutes per request). Push and PR builds never sign.

---

## 中文附注

- 表单由你本人提交。上面的数字为 2026-10-07 核查结果（GitHub 0 star / 1 fork；uTools「鹅的笔记」24 个评分、均分 4.6，约 3100 用户，用户数取自商店页面缓存），提交前请到页面再确认一遍。
- SignPath 会看「可验证的知名度」。本仓库较新且 star 很少，被拒概率不低；被拒通常会建议有更多外部认可后再申请。uTools 商店数据是目前最有力的证据，可以在 Reputation 里如实写明。
- 申请前建议处理的风险点（不处理也能提交，但审核可能会问）：
  1. 远程加载的非开源字体：「仓耳今楷」（从 eachann1024/Resources 加载，属专有免费字体），以及 AI HTML 组件从 assets.claude.ai 加载的 Anthropic Sans/Serif。可考虑换成 OFL 字体（如霞鹜文楷）或系统字体。
  2. 自动联网：更新检查（启动 + 每 4 小时）、DM Mono 字体、欢迎页图片（维护者的腾讯云 COS）。都不含用户数据，PRIVACY.md 已如实列出；若想用 SignPath 官方那句「不会向用户未指定的系统传输信息」，需要把字体和图片打包进应用，并给更新检查加开关。
- SignPath 要求 GitHub 与 SignPath 账号都开启双重验证（MFA）。
- 获批后要配置的值见上面「After approval」第 4 步：1 个 secret（`SIGNPATH_API_TOKEN`）+ 1 个变量（`SIGNPATH_ORGANIZATION_ID`），slug 不同于默认值时再加对应变量。配好之前，workflow 会自动跳过签名，现有发布不受影响。
