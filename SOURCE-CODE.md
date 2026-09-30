# 对应版本源码与构建

源码、安装包、产品视频和构建记录统一位于公开仓库：
https://github.com/eachann1024/goose-notes

当前源码使用 MIT，第三方部分保留各自许可与版权声明。BlockNote core/react/mantine 使用 MPL-2.0；项目对其覆盖文件的补丁保留 MPL-2.0。AI 菜单与 PDF 导出已改为项目独立实现，不再依赖 BlockNote XL AI/PDF 包。

每次正式构建附固定提交的源码归档、LICENSE、THIRD-PARTY-NOTICES.txt、构建记录与 SHA256SUMS.txt。源码归档包含 package.json、bun.lock、构建配置、public/legal 及 scripts 下的构建和安装脚本，不包含私人笔记、凭据或缓存。

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

## 历史发布

从 goose-note-app 迁入的历史安装包保持原文件、原版本号与原许可。它们包含的 BlockNote XL 依赖仍沿用 GPLv3；当前源码许可不追溯改变历史二进制的许可或分发义务。

每个迁入版本附原应用源码提交的归档与 LEGACY-LICENSE.txt。应用源码归档不代表已包含所有第三方依赖的对应源码；历史版本仍需按原许可保留必要依赖源码、声明和修改。
