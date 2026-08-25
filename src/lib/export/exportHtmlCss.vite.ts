import reactCss from "@blocknote/react/style.css?raw";
import blockBackgroundCss from "../../pages/workspace/styles/block-background.css?raw";
import editorBaseEntry from "../../pages/workspace/styles/editor-base.css?raw";

const editorBaseParts = import.meta.glob(
  "../../pages/workspace/styles/editor-base/*.css",
  { query: "?raw", eager: true, import: "default" },
) as Record<string, string>;

function loadEditorBaseCss(): string {
  const names = [
    ...editorBaseEntry.matchAll(/@import\s+"\.\/editor-base\/([^"]+)";/g),
  ].map((match) => match[1]);
  if (names.length === 0) {
    throw new Error("editor-base.css 未声明子文件");
  }
  return names
    .map((name) => {
      const key = Object.keys(editorBaseParts).find((path) =>
        path.endsWith(`/${name}`),
      );
      if (!key) throw new Error(`导出样式缺少 ${name}`);
      return editorBaseParts[key];
    })
    .join("\n");
}

/** Vite 打包用：把官方编辑器样式和本仓覆盖收成字符串。 */
export const EXPORT_VENDOR_CSS = [
  reactCss,
  blockBackgroundCss,
  loadEditorBaseCss(),
].join("\n");
