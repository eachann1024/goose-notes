#!/usr/bin/env node
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pack = resolve(root, "dist-electron/app-pack");
let pkg;
try {
  pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
} catch (err) {
  throw new Error(`Failed to parse root package.json: ${err.message}`);
}

// Linux deb/pacman 需要 maintainer（要求邮箱格式）。优先取环境变量，其次取 package.json 的 author，
// 最后给一个 GitHub-style no-reply 兜底，避免 deb/pacman 因缺 author 邮箱直接失败。
const linuxMaintainer =
  process.env.LINUX_MAINTAINER ||
  (typeof pkg.author === "string" && pkg.author.includes("@") ? pkg.author : undefined) ||
  (pkg.author?.email
    ? `${pkg.author.name} <${pkg.author.email}>`.trim()
    : undefined) ||
  "Goose Note <goose-note@users.noreply.github.com>";

rmSync(pack, { recursive: true, force: true });
mkdirSync(pack, { recursive: true });
for (const dir of ["main", "preload", "renderer"]) {
  cpSync(resolve(root, "dist-electron", dir), resolve(pack, dir), {
    recursive: true,
  });
}
cpSync(resolve(root, "electron/icons/icon.icns"), resolve(pack, "icon.icns"));
cpSync(resolve(root, "electron/icons/icon.ico"), resolve(pack, "icon.ico"));
cpSync(resolve(root, "electron/icons/icon.png"), resolve(pack, "icon.png"));
mkdirSync(resolve(pack, "node_modules"), { recursive: true });

function stripPackJunk(dir) {
  if (process.env.GOOSE_DEBUG === "1") return;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      const info = statSync(full);
      if (info.isDirectory()) {
        if (name === "test" || name === "tests" || name === "__tests__") {
          rmSync(full, { recursive: true, force: true });
        } else {
          stack.push(full);
        }
      } else if (
        name.endsWith(".map") ||
        name.endsWith(".md") ||
        name.endsWith(".d.ts")
      ) {
        unlinkSync(full);
      }
    }
  }
}

stripPackJunk(pack);

// Legal notices and source instructions must survive release-file filtering.
for (const file of ["LICENSE", "THIRD-PARTY-NOTICES.txt"]) {
  cpSync(resolve(root, file), resolve(pack, file));
}
cpSync(resolve(root, "SOURCE-CODE.md"), resolve(pack, "SOURCE-CODE.txt"));

writeFileSync(
  resolve(pack, "package.json"),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      author: pkg.author,
      homepage: pkg.homepage || "https://github.com/eachann1024/goose-notes",
      license: pkg.license,
      private: true,
      type: "module",
      main: "main/index.js",
      productName: "Goose Note",
    },
    null,
    2,
  ) + "\n",
);

writeFileSync(
  resolve(pack, "electron-builder.yml"),
  `appId: com.goosenote.desktop
productName: Goose Note
copyright: Copyright © Goose Note
directories:
  output: ../packaged
asar: true
npmRebuild: false
electronVersion: 44.0.0
compression: maximum
# mac 上 Chromium 语言包是 zh_CN.lproj（下划线）。必须带 zh_CN，否则 zh-CN 匹配不到。
electronLanguages:
  - zh_CN
  - zh-CN
  - zh-Hans
  - en
  - en-US
files:
  - "!**/*.map"
  - "!**/*.md"
  - "!**/*.d.ts"
  - "!**/test/**"
  - "!**/tests/**"
  - "!**/__tests__/**"
  - "!icon.icns"
  - "!icon.ico"
  # BrowserWindow 在 Linux/Windows 从 app.asar/icon.png 读取窗口图标，必须保留。
  - "!electron-builder.yml"
fileAssociations:
  - ext: md
    name: Markdown
    description: Markdown 文档
    mimeType: text/markdown
    role: Editor
    icon: icon.icns
  - ext: markdown
    name: Markdown
    description: Markdown 文档
    mimeType: text/markdown
    role: Editor
    icon: icon.icns
mac:
  icon: icon.icns
  category: public.app-category.productivity
  ${process.env.CSC_LINK ? '# CI Developer ID signing via CSC_LINK' : 'identity: null'}
  hardenedRuntime: ${Boolean(process.env.CSC_LINK)}
  gatekeeperAssess: false
  extendInfo:
    LSMultipleInstancesProhibited: true
    NSAppleEventsUsageDescription: Goose Note 需要发送系统事件，以便用快捷键唤出主窗口和速记小窗。
    NSAccessibilityUsageDescription: Goose Note 需要辅助功能权限，以便在其他应用处于前台时用快捷键唤出主窗口和速记小窗。
  target:
    - target: dir
      arch:
        - arm64
        - x64
win:
  icon: icon.ico
  # true：把 icon/版本信息写入 exe；CI 已关 CSC_IDENTITY_AUTO_DISCOVERY，不会真签名
  signAndEditExecutable: true
  target:
    - target: nsis
      arch:
        - x64
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  installerIcon: icon.ico
  uninstallerIcon: icon.ico
  installerHeaderIcon: icon.ico
  artifactName: \${productName}-\${version}-\${arch}-setup.\${ext}
linux:
  icon: icon.png
  category: Utility
  vendor: ${pkg.productName || "goose-note"}
  synopsis: ${pkg.description || "Local-first note taking app"}
  maintainer: ${linuxMaintainer}
  target:
    - AppImage
    - deb
    - pacman
  desktop:
    entry:
      Name: Goose Note
      Comment: Local-first notes
      Categories: Office;Note;
      MimeType: text/markdown;text/x-markdown;
      # 打包版 WM_CLASS 是 productName 的小写中划线形式 "goose-note"（实测 AppImage/deb）；
      # 开发实例（electron .）才是 package.json name "goose-note-app"，
      # 开发机图标匹配请在 ~/.local/share/applications 放 goose-note-app.desktop。
      StartupWMClass: goose-note
pacman:
  depends:
    - gtk3
    - nss
    - alsa-lib
    - libxss
    - libxtst
    - libnotify
    - libsecret
    - xdg-utils
    - libappindicator-gtk3
`,
);
console.log("[electron] packed app dir → dist-electron/app-pack");
