import path from "node:path";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import type { Plugin } from "vite";
import { isQuicknoteBuild } from "./targets";
export function createAssetPlugin(root: string): Plugin {
  return {
    name: "exclude-guide-assets-from-electron",
    closeBundle() {
      const outDir = isQuicknoteBuild
        ? "dist-quicknote"
        : "dist-electron/renderer";
      rmSync(path.resolve(root, outDir, "guide"), {
        recursive: true,
        force: true,
      });
      // 禁止 NotoSansSC 打进产物；其它 public/fonts（如 UI 字体）不动
      for (const name of ["NotoSansSC-Regular.ttf", "NotoSansSC-Regular.otf"]) {
        rmSync(path.resolve(root, outDir, "fonts", name), { force: true });
      }
      // KaTeX CSS 相对 url(fonts/KaTeX_*)，对齐到 assets/fonts/*.woff2
      const katexFontSrc = path.resolve(root, "node_modules/katex/dist/fonts");
      const katexFontDest = path.resolve(root, outDir, "assets/fonts");
      if (existsSync(katexFontSrc)) {
        mkdirSync(katexFontDest, { recursive: true });
        for (const name of readdirSync(katexFontSrc)) {
          if (!name.endsWith(".woff2")) continue;
          copyFileSync(
            path.join(katexFontSrc, name),
            path.join(katexFontDest, name),
          );
        }
      }
    },
  };
}
