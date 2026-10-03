# 自动构建与下载

每次推送到代码分支、以及面向 `main` 的 PR 创建或更新，都会自动运行 **Desktop installers**，生成 Windows x64、macOS arm64/x64、Linux x64 安装包和对应源码。生成预览媒体的孤儿分支 `ui-previews` 不包含应用源码，因此不触发打包。所有任务共用固定提交；PR 打包的是 PR 的 head SHA，推送打包的是该次推送的 SHA。流程不取消较早提交的构建。

每月奇数日（北京时间 07:00）仍会检查 `main`，有新提交时构建并发布；也可在 Actions 中手动运行 **Desktop installers**。只有 `main` 的定时或手动运行在全部平台和源码归档成功后，才将安装包、源码及校验值发布到 [goose-notes Releases](https://github.com/eachann1024/goose-notes/releases/latest)，并维护 Homebrew Cask 和更新信息。推送和 PR 运行只生成 Actions 附件，不使用签名凭证或发布权限。已发布的同一提交保持原附件；只改变更新信息或 Cask 的提交不会触发下一次定时重建。不向 AUR 发布。

发布的安装包可在 https://github.com/eachann1024/goose-notes/releases 的 **Assets** 下载。每次提交的安装包位于 https://github.com/eachann1024/goose-notes/actions/workflows/desktop-build.yml ：打开对应提交的成功运行，在 **Artifacts** 下载 `goose-note-<平台>-<架构>-<完整 SHA>`；源码附件为 `source-<完整 SHA>`。Actions 附件下载需要登录 GitHub；产物保留 30 天，Release 附件不使用此到期策略；过期后可从固定提交重新构建。下载的 Actions ZIP 是外层归档，请先解压；macOS 包内的应用 `.zip` 解压后是 `Goose Note.app`。

| 系统 | CPU | 安装包 |
| --- | --- | --- |
| Windows | x64 | NSIS `.exe` |
| macOS | Apple Silicon arm64 | `.dmg`、应用 `.zip` |
| macOS | Intel x64 | `.dmg`、应用 `.zip` |
| Linux | x64 | `.AppImage`、`.deb`、`.rpm` |
| Arch Linux / 兼容发行版 | x86_64 | `.pacman`（electron-builder 26 生成的 pacman 包） |

Arch 指 Linux 发行版。解压下载归档后执行 `sudo pacman -U ./goose-note-app-*.pacman`；包管理器解析并安装依赖。CI 在 Arch 官方容器中实际安装包、检查安装记录和应用资源。此检查不代替图形桌面启动和功能验收。AppImage 可作为另一种 Linux 分发方式，部分系统需安装 FUSE。

这些是未签名的开发测试构建；macOS 未公证，Windows 未做 Authenticode 签名。系统可能提示未知开发者。只对确认来源的构建按操作系统提示操作。应用版本来自 package.json；提交 SHA 和运行 ID 用于区分同版本不同构建，不应当作新的稳定发布版本。

每个平台归档包含 `BUILD.json`、`SHA256SUMS.txt`、MIT 许可和第三方声明。同一运行的 `source-<SHA>` 包含 `git archive` 生成的准确项目源码、锁文件、构建脚本及声明，不包含未提交的本地工作。项目源码归档不等同于已完成全部依赖的对应源码交付；公开分发前仍须按 SOURCE-CODE.md 补齐必要的依赖源码、核对第三方声明和字体来源。

## 复现

使用对应操作系统、Node.js 22、Bun 1.3.14。Linux 安装 `rpm` 和 `libarchive-tools`；macOS 安装 Xcode Command Line Tools。

```sh
bun install --frozen-lockfile
bun run build:electron
node scripts/build-ci-installers.mjs mac arm64
# 其他组合：mac x64、win x64、linux x64
```

安装包和校验清单位于 `dist-desktop/ci/`。CI 使用冻结锁文件，不依赖本机未提交修改。macOS arm64 还执行 `bun run mac` 验证原生应用构建和安装；打包检查包括所需格式是否齐全、Arch 包可安装。不表示所有桌面交互已经验收。现有 `aiPanelFocus.ts` 类型检查问题不作为此打包流水线的通过依据，类型检查需单独处理。
