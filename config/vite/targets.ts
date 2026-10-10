import path from "node:path";
// 构建目标区分：
// - 默认（app）：input=index.html → dist/，完整功能（plugin A 鹅的笔记）。行为与改动前一致。
// - GOOSE_BUILD_TARGET=quicknote：input=quicknote.html → dist-quicknote/，精简（plugin B 鹅的小窗）。
//   通过 __GOOSE_LITE__ 标志 + 重型依赖 alias 到空壳，把 katex/mermaid/prettier/PDF/echarts
//   等「文档级」代码排除出小窗包（约省 9MB），小窗只保留快速记文字/标题/清单/代码高亮等。
// - GOOSE_BUILD_TARGET=electron：input=index.html + quicknote.html → dist-electron/renderer/，Electron 桌面端（仅本地模式）。
//   renderer 与 main/preload 由 Electron 构建链分别产出。
export const isQuicknoteBuild = process.env.GOOSE_BUILD_TARGET === "quicknote";
export function createBuildInput(root: string) {
  const quicknoteInput = { quicknote: path.resolve(root, "quicknote.html") };
  const desktopInput = {
    index: path.resolve(root, "index.html"),
    assetMaintenance: path.resolve(root, "asset-maintenance.html"),
    quicknote: path.resolve(root, "quicknote.html"),
  };
  return isQuicknoteBuild ? quicknoteInput : desktopInput;
}
export const hostTarget = "electron";
