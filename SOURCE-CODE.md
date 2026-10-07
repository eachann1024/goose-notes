# 对应版本源码与构建

源码、安装包、产品视频和构建记录统一位于公开仓库：
https://github.com/eachann1024/goose-notes

当前源码使用 MIT，第三方部分保留各自许可与版权声明。BlockNote core/react/mantine 使用 MPL-2.0；项目对其覆盖文件的补丁保留 MPL-2.0。AI 菜单与 PDF 导出已改为项目独立实现，不再依赖 BlockNote XL AI/PDF 包。

每个正式 Release 的 tag 指向构建所用的固定提交，GitHub 在 Release 页自动附带该提交的 Source code 归档（zip / tar.gz），即对应源码，包含 package.json、bun.lock、构建配置、patches、public/legal 及 scripts 下的构建和安装脚本，不包含私人笔记、凭据或缓存。LICENSE、THIRD-PARTY-NOTICES.txt 与本说明（SOURCE-CODE.txt）随每个安装包附带在应用资源中；Release 附件只有安装包和 SHA256SUMS.txt。CI 运行另保留 `git archive` 源码归档与各平台 BUILD.json 构建记录（Actions 附件，30 天）。

## 构建

使用 package.json 指定的 Bun 版本和 Node.js 20 或以上。

```bash
bun install --frozen-lockfile
node scripts/generate-license-notices.mjs
bun run build
bun run mac    # macOS
bun run win    # Windows
bun run linux  # Linux
```

完整环境与构建说明见 DEVELOP.md。各平台构建需要相应操作系统工具链。
