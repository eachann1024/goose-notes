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
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

// Linux deb/rpm 需要 maintainer（要求邮箱格式）。优先取环境变量，其次取 package.json 的 author，
// 最后给一个 GitHub-style no-reply 兜底，避免 deb/rpm 因缺 author 邮箱直接失败。
const linuxMaintainer =
  process.env.LINUX_MAINTAINER ||
  (typeof pkg.author === "string" ? pkg.author : undefined) ||
  (pkg.author?.email ? `${pkg.author.name} <${pkg.author.email}>`.trim() : undefined) ||
  "Goose Note <goose-note@users.noreply.github.com>";

rmSync(pack, { recursive: true, force: true });
mkdirSync(pack, { recursive: true });
for (const dir of ["main", "preload", "renderer"]) {
  cpSync(resolve(root, "dist-electron", dir), resolve(pack, dir), { recursive: true });
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

writeFileSync(
  resolve(pack, "package.json"),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
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
  - "!icon.png"
  - "!electron-builder.yml"
mac:
  icon: icon.icns
  category: public.app-category.productivity
  identity: null
  hardenedRuntime: false
  gatekeeperAssess: false
  extendInfo:
    LSMultipleInstancesProhibited: true
  target:
    - target: dir
      arch:
        - arm64
        - x64
win:
  icon: icon.ico
  signAndEditExecutable: false
  target:
    - target: nsis
      arch:
        - x64
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  artifactName: \${productName}-\${version}-x64-setup.\${ext}
linux:
  icon: icon.png
  category: Utility
  vendor: ${pkg.productName || "goose-note"}
  synopsis: ${pkg.description || "Local-first note taking app"}
  maintainer: ${linuxMaintainer}
  target:
    - AppImage
    - deb
    - rpm
  desktop:
    entry:
      Name: Goose Note
      Comment: Local-first notes
      Categories: Office;Note;
`,
);
console.log("[electron] packed app dir → dist-electron/app-pack");
