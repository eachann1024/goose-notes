import type { BuildOptions } from "vite";
import { debugMinify, debugSourcemap } from "../../vite.debug";
import { isQuicknoteBuild, createBuildInput } from "./targets";
import { codeSplittingGroups } from "./chunkGroups";
export function createBuildOptions(root: string): BuildOptions {
  return {
    // app → dist/；quicknote → dist-quicknote/（两个 Electron 插件各自独立打包，互不共享 chunk）；
    // electron → dist-electron/renderer/（桌面端独立产物，electron-build.js 只认 dist/dist-quicknote，不会触碰）。
    outDir: isQuicknoteBuild ? "dist-quicknote" : "dist-electron/renderer",
    // 正式 'hidden'（写盘后由 electron-build 删）；GOOSE_DEBUG=1 时 true（保留，供 DevTools 还原 src/）
    sourcemap: debugSourcemap,
    minify: debugMinify,
    rolldownOptions: {
      // 单入口按构建目标切换：主应用打 index.html，小窗只打 quicknote.html。
      // 分开构建让 rolldown 各自按入口可达性裁剪——小窗图不含 workspace <App/>，
      // 自动甩掉 echarts / PDF 导出 / AI 图表等仅主应用需要的代码。
      // Electron 桌面端同时打 index.html（主窗）与 quicknote.html（速记小窗），outDir 为 dist-electron/renderer。
      input: createBuildInput(root),
      output: {
        // rolldown 原生分包；不用废弃的 manualChunks
        codeSplitting: {
          groups: codeSplittingGroups,
        },
        sourcemapIgnoreList: false,
        chunkFileNames: "chunks/[name].js",
        entryFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
      onwarn(warning, warn) {
        if (warning.code === "INEFFECTIVE_DYNAMIC_IMPORT") return;
        // KaTeX CSS 里字体用相对路径引用自身，Vite 打包后基准目录变动导致此警告，运行时正常
        if (
          warning.code === "UNRESOLVED_IMPORT" &&
          warning.message?.includes("fonts/KaTeX_")
        )
          return;
        if (
          warning.message?.includes("didn't resolve at build time") &&
          warning.message?.includes("KaTeX_")
        )
          return;
        warn(warning);
      },
    },
    chunkSizeWarningLimit: 3000,
    reportCompressedSize: false,
  };
}
