import path from "node:path";
import { existsSync } from "node:fs";
import { isQuicknoteBuild } from "./targets";
export function createResolveOptions(root: string) {
  // 小窗精简构建专用：把这些「仅经动态 import 进入图」的重型 JS 依赖 alias 到极小空壳，
  // 确保它们不被打进 dist-quicknote（消费点已被 __GOOSE_LITE__ 短路，运行时不会真正调用）。
  //
  // 必须用「精确正则」只匹配裸包名 / 精确子路径的 JS import，不能用字符串前缀别名——
  // 否则会误伤 index.css 里的 `@import "katex/dist/katex.min.css"`（被改写成空壳目录下的
  // 不存在路径而构建失败）。katex CSS（~23KB）保留无妨，这里只剥离 katex 的 JS（~256KB）。
  const liteEmptyModule = path.resolve(
    root,
    "./src/lib/vite-stubs/lite-empty.ts",
  );
  // pi-ai provider-env 静态 require("node:fs")（仅 Bun sandbox 回退，浏览器不可达）；
  // alias 掉以免 Vite 外部化并打警告。
  const nodeFsStubModule = path.resolve(
    root,
    "./src/lib/vite-stubs/node-fs-stub.ts",
  );
  // 挡住 旧 PDF 导出的 Inter_18pt / GeistMono TTF chunk（~1.8MB）。
  const pdfFontEmptyModule = path.resolve(
    root,
    "./src/lib/vite-stubs/pdf-font-empty.ts",
  );
  if (
    !existsSync(liteEmptyModule) ||
    !existsSync(nodeFsStubModule) ||
    !existsSync(pdfFontEmptyModule)
  ) {
    throw new Error(
      `[vite] 缺少构建 stub（${path.relative(root, liteEmptyModule)} / ${path.relative(root, nodeFsStubModule)} / ${path.relative(root, pdfFontEmptyModule)}）。` +
        "不要把这些文件放在名为 build 的目录里：全局 gitignore 的 build/ 会让 electron publish 漏传，商店 Linux CI 会挂。",
    );
  }
  const liteStubAliases: { find: RegExp; replacement: string }[] =
    isQuicknoteBuild
      ? [
          { find: /^katex$/, replacement: liteEmptyModule },
          { find: /^mermaid$/, replacement: liteEmptyModule },
          { find: /^echarts$/, replacement: liteEmptyModule },
          { find: /^@react-pdf\/renderer$/, replacement: liteEmptyModule },
          { find: /^prettier\/standalone$/, replacement: liteEmptyModule },
          { find: /^prettier\/plugins\/.+$/, replacement: liteEmptyModule },
          { find: /^@ai-sdk\/openai$/, replacement: liteEmptyModule },
          {
            find: /^@ai-sdk\/openai-compatible$/,
            replacement: liteEmptyModule,
          },
          { find: /^@ai-sdk\/anthropic$/, replacement: liteEmptyModule },
          { find: /exportHtmlCss\.vite/, replacement: liteEmptyModule },
        ]
      : [
          // 必须整段匹配 specifier（含 ./），否则 Vite 8 只替换子串，变成
          // `.//abs/path/pdf-font-empty.tsRegular-xxxx.js` 后构建失败。
          {
            find: /(?:^|.*\/)Inter_18pt-[^/]+$/,
            replacement: pdfFontEmptyModule,
          },
          {
            find: /(?:^|.*\/)GeistMono-Regular[^/]*$/,
            replacement: pdfFontEmptyModule,
          },
        ];

  return {
    dedupe: [
      // React 单实例：dev 预构建 + 任何冷发现的非预构建模块都解析到同一份 react/react-dom，
      // hooks dispatcher 为 null → useMemo 读 null → 整页白屏（Invalid hook call）。
      "react",
      "react-dom",
      // BlockNote 内核/视图层也强制单实例，保证编辑器组件共享同一 core/react 运行时。
      "@blocknote/core",
      "@blocknote/react",
      "@blocknote/mantine",
      "prosemirror-model",
      "prosemirror-state",
      "prosemirror-transform",
      "prosemirror-view",
      "prosemirror-tables",
    ],
    // 数组形式（含正则项）：小窗精简构建的空壳 alias 放最前，精确匹配重型包名；
    // 非小窗构建 liteStubAliases 为空数组，主应用解析与改动前完全一致。
    alias: [
      ...liteStubAliases,
      // 浏览器打包：吞掉 pi-ai 对 node:fs 的静态 require（见 src/lib/vite-stubs/node-fs-stub.ts）。
      { find: /^node:fs$/, replacement: nodeFsStubModule },
      {
        find: "@host-runtime",
        replacement: path.resolve(root, "./src/lib/host/runtime.electron.ts"),
      },

      { find: "@", replacement: path.resolve(root, "./src") },
    ],
  };
}
