# 对应版本源码与构建

项目：https://github.com/eachann1024/goose-notes

项目目前在私有仓库中维护，尚未公开发布；此链接不代表当前版本已有公众可访问的对应源码下载。公开分发前，发布者必须同时提供匹配该构建的源码包或可访问的固定版本地址，而不是只链接会变化的 main。

源码包应包括该版本完整的源码、LICENSE、THIRD-PARTY-NOTICES.txt、public/legal、package.json、bun.lock、构建配置、scripts/ 下所需构建／安装脚本，以及适用 GPL 的对应源码要求涉及的依赖源码和修改。按 GPL 要求提供安装信息（如适用）。不要包含私人笔记、凭据、demo-profile 或本地缓存。

BlockNote XL AI/PDF 0.51.3 使用 GPLv3；core/react/mantine 0.51.3 保留 MPL-2.0。应提供与实际使用版本匹配的覆盖源码及修改，并保留接收者在原许可下的权利。包的源码版本与获取渠道见依赖清单，发布者仍需确保其可获得性；单独列出上游主页不能代替履行义务。

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

完整环境与构建说明见 DEVELOP.md。平台构建需要相应操作系统工具链，不能把某平台的本地构建成功视为所有平台验收成功。

## 发布时

为每一个二进制／安装包记录 Git 提交与全部构建修改，提供对应源码归档、必要依赖源码、构建步骤及校验值。将该归档与二进制放在同一下载页面，或使用 GPL 允许的其他提供方式；保持源码获取方式有效。尚未公开源码和安装包时不要宣传下载已经可用。
