/**
 * 独立 HTML / printToPDF 共用的编辑器样式。
 * Node 单测走磁盘；浏览器走 Vite `?raw` 异步块，避免 markdown 导出把 CSS 打进主包。
 */

import { existsSync, readFileSync } from "node:fs";
import { SYSTEM_FONT_STACK } from "@/lib/fontLoader";

/** 磁盘读入口时展开相对 @import，避免只拿到声明、丢掉拆分后的规则。 */
function readCssResolvingLocalImports(file: string): string {
  const dir = file.replace(/[/\\][^/\\]+$/, "");
  return readFileSync(file, "utf8").replace(
    /@import\s+"([^"]+)";\s*/g,
    (_, rel: string) => {
      const abs = rel.startsWith("./") ? `${dir}/${rel.slice(2)}` : `${dir}/${rel}`;
      return `${readFileSync(abs, "utf8")}\n`;
    },
  );
}

const EXPORT_LIGHT_TOKENS = `
:root {
  color-scheme: light;
  --editor-font-size: 16px;
  --editor-scale: 1;
  --editor-module-sm-font-size: 14px;
  --font-default: ${SYSTEM_FONT_STACK};
  --font-mono: ui-monospace, "DM Mono", Menlo, Consolas,
    "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC",
    monospace;
  --foreground: 0 0% 12%;
  --muted: 60 2% 96%;
  --muted-foreground: 0 0% 43%;
  --border: 0 0% 86%;
  --goose-interactive-selected: #e0e7ff;
  --goose-interactive-selected-fg: #4f46e5;
  --goose-callout-accent: #6366f1;
  --goose-callout-bg: #f7f6f3;
  --goose-callout-border: #e9e9e7;
  --goose-block-subtle-bg: #f3f2f1;
  --goose-block-subtle-border: #e8e7e5;
  --goose-inline-code-bg: #eef2ff;
  --goose-inline-code-fg: #4f46e5;
  --goose-editor-highlight-gray-text: #9b9a97;
  --goose-editor-highlight-gray-bg: #ebeced;
  --goose-editor-highlight-brown-text: #64473a;
  --goose-editor-highlight-brown-bg: #e9e5e3;
  --goose-editor-highlight-red-text: #e03e3e;
  --goose-editor-highlight-red-bg: #fbe4e4;
  --goose-editor-highlight-orange-text: #d9730d;
  --goose-editor-highlight-orange-bg: #f6e9d9;
  --goose-editor-highlight-yellow-text: #dfab01;
  --goose-editor-highlight-yellow-bg: #fbf3db;
  --goose-editor-highlight-green-text: #4d6461;
  --goose-editor-highlight-green-bg: #ddedea;
  --goose-editor-highlight-blue-text: #0b6e99;
  --goose-editor-highlight-blue-bg: #ddebf1;
  --goose-editor-highlight-purple-text: #6940a5;
  --goose-editor-highlight-purple-bg: #eae4f2;
  --goose-editor-highlight-pink-text: #ad1a72;
  --goose-editor-highlight-pink-bg: #f4dfeb;
}
.bn-root {
  --bn-colors-highlights-gray-text: var(--goose-editor-highlight-gray-text);
  --bn-colors-highlights-gray-background: var(--goose-editor-highlight-gray-bg);
  --bn-colors-highlights-brown-text: var(--goose-editor-highlight-brown-text);
  --bn-colors-highlights-brown-background: var(--goose-editor-highlight-brown-bg);
  --bn-colors-highlights-red-text: var(--goose-editor-highlight-red-text);
  --bn-colors-highlights-red-background: var(--goose-editor-highlight-red-bg);
  --bn-colors-highlights-orange-text: var(--goose-editor-highlight-orange-text);
  --bn-colors-highlights-orange-background: var(--goose-editor-highlight-orange-bg);
  --bn-colors-highlights-yellow-text: var(--goose-editor-highlight-yellow-text);
  --bn-colors-highlights-yellow-background: var(--goose-editor-highlight-yellow-bg);
  --bn-colors-highlights-green-text: var(--goose-editor-highlight-green-text);
  --bn-colors-highlights-green-background: var(--goose-editor-highlight-green-bg);
  --bn-colors-highlights-blue-text: var(--goose-editor-highlight-blue-text);
  --bn-colors-highlights-blue-background: var(--goose-editor-highlight-blue-bg);
  --bn-colors-highlights-purple-text: var(--goose-editor-highlight-purple-text);
  --bn-colors-highlights-purple-background: var(--goose-editor-highlight-purple-bg);
  --bn-colors-highlights-pink-text: var(--goose-editor-highlight-pink-text);
  --bn-colors-highlights-pink-background: var(--goose-editor-highlight-pink-bg);
}
.bn-default-styles,
.bn-editor {
  font-family: var(--font-default);
  font-size: var(--editor-font-size);
}
`;

const EXPORT_FALLBACK_CSS = `
[data-callout="true"],
.workspace-editor-surface [data-callout="true"] {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  box-sizing: border-box;
  border-radius: 0.5rem;
  border: 1px solid var(--goose-callout-border);
  background: var(--goose-callout-bg);
  padding: 0.5rem 0.75rem;
  font-size: var(--editor-module-sm-font-size);
  line-height: 1.5;
}
[data-callout="true"] .callout-content {
  min-width: 0;
  flex: 1;
}
[data-callout="true"] button,
[data-callout="true"] button[data-callout-icon-trigger],
[data-callout="true"] .callout-icon-slot {
  appearance: none;
  -webkit-appearance: none;
  border: 0;
  outline: 0;
  box-shadow: none;
  background: transparent;
  padding: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5em;
  height: 1.5em;
  min-width: 1.5em;
  min-height: 1.5em;
  line-height: 0;
  color: inherit;
  flex-shrink: 0;
}
[data-callout="true"] svg,
[data-callout="true"] .lucide {
  display: block;
  width: 1em;
  height: 1em;
  overflow: visible;
  stroke-width: 1.75;
}
.goose-file-block-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 6px;
  background-color: #f3f2f1;
  border: 1px solid #e8e7e5;
  width: 100%;
  box-sizing: border-box;
}
.goose-file-block-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
  color: #1f2329;
}
.goose-video-block-shell {
  display: block;
  max-width: 100%;
}
.goose-video-player__video,
.goose-video-block-shell video,
.bn-visual-media {
  display: block;
  max-width: 100%;
  height: auto;
}
.workspace-editor-surface
  .bn-block-content[data-content-type="checkListItem"]
  > div
  > input {
  border: 0.09em solid #57606a;
}
.workspace-editor-surface
  .bn-block-content[data-content-type="checkListItem"][data-checked="true"]
  .bn-inline-content {
  color: #57606a;
}
`;

const VENDOR_CSS_FILES = [
  "node_modules/@blocknote/react/dist/style.css",
  "src/pages/workspace/styles/block-background.css",
  "src/pages/workspace/styles/editor-base.css",
];

function tryLoadVendorCssFromFs(): string | null {
  try {
    if (!existsSync(VENDOR_CSS_FILES[0])) return null;
    return VENDOR_CSS_FILES.map((file) =>
      file.endsWith("editor-base.css")
        ? readCssResolvingLocalImports(file)
        : readFileSync(file, "utf8"),
    ).join("\n");
  } catch {
    return null;
  }
}

function assembleExportCss(vendorCss: string): string {
  return [EXPORT_LIGHT_TOKENS, vendorCss, EXPORT_FALLBACK_CSS].join("\n");
}

async function loadViteVendorCss(): Promise<string> {
  // Vite 编译期展开；Playwright 单测不会走到这里（先读磁盘）。
  const loaders = import.meta.glob("./exportHtmlCss.vite.ts");
  const load = loaders["./exportHtmlCss.vite.ts"];
  if (!load) throw new Error("导出样式未打包");
  const mod = (await load()) as { EXPORT_VENDOR_CSS: string };
  return mod.EXPORT_VENDOR_CSS;
}

export async function getExportHtmlCss(): Promise<string> {
  const fromFs = tryLoadVendorCssFromFs();
  if (fromFs) return assembleExportCss(fromFs);
  if (typeof __GOOSE_LITE__ !== "undefined" && __GOOSE_LITE__) {
    throw new Error("速记小窗不支持 BlockNote HTML 导出");
  }
  return assembleExportCss(await loadViteVendorCss());
}

/** Electron 旧内核 printToPDF：去掉 hsl(var)/alpha，避免整块实色。 */
export function sanitizePrintCss(css: string): string {
  return css
    .replace(/[^{};]+:[^;{}]*hsl\(\s*var\([^;{}]*;/g, "")
    .replace(/hsl\(\s*var\([^)]*\)\s*\/\s*[^)]+\)/g, "transparent")
    .replace(/hsl\(\s*var\([^)]*\)\)/g, "#1f2329");
}
