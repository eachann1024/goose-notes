// Vite 8 底层是 rolldown。分包用 rolldown 原生 codeSplitting.groups，
// 不用已废弃的 output.manualChunks（rolldown 文档：manualChunks 与 codeSplitting 同时配置时
// manualChunks 会被忽略；这里统一走 codeSplitting）。
//
// 约定：
// - test 用 [\\/] 兼容 Windows 路径分隔符（rolldown 官方建议）。
// - priority 越大越先匹配；命中后该模块从其它组移除。兜底组 priority 最低。
// - entriesAware:true 让组按"被哪些入口/动态 import 链使用"再细分子 chunk，
//   保住源码里精心做的懒加载边界（docx 静态、pdf/jszip 动态 import），
//   避免把 docx + react-pdf + jszip 强行并进一个 3.5MB 大 chunk 后全量 eager 下载。
type ChunkGroup = {
  name: string;
  test: RegExp;
  priority: number;
  entriesAware?: boolean;
};

export const codeSplittingGroups: ChunkGroup[] = [
  // React 运行时：优先级最高，确保 react / react-dom / 调度器不被卷进 blocknote 等组
  {
    name: "vendor-react",
    test: /[\\/]node_modules[\\/](react|react-dom|scheduler|use-sync-external-store|zustand)[\\/]/,
    priority: 50,
  },
  // ProseMirror 内核（blocknote 底层）
  {
    name: "vendor-prosemirror",
    test: /[\\/]node_modules[\\/]prosemirror-[^\\/]+[\\/]/,
    priority: 40,
  },
  // BlockNote 编辑器（core + react + mantine）
  {
    name: "vendor-blocknote",
    test: /[\\/]node_modules[\\/]@blocknote[\\/](core|react|mantine)[\\/]/,
    priority: 39,
  },
  // 文档导出：docx / pdf / zip。entriesAware 让其按实际使用入口拆分，
  // 用户只导出 Word 时不会被迫下载 react-pdf 的体积。
  {
    name: "vendor-export",
    test: /[\\/]node_modules[\\/](docx|jszip|@react-pdf[\\/]renderer)[\\/]/,
    priority: 38,
    entriesAware: true,
  },
  // AI SDK — 较大，单独隔离方便缓存
  {
    name: "vendor-ai",
    test: /[\\/]node_modules[\\/](ai|@ai-sdk[\\/][^\\/]+)[\\/]/,
    priority: 30,
  },
  // Mermaid（源码里 MermaidView 用 `await import("mermaid")` 懒加载）。
  // 必须 entriesAware:true，否则会被下面的兜底 vendor 组卷进 eager vendor.js（曾达 7MB），
  // 让源码的懒加载边界失效。这里只匹配 mermaid 私有依赖（cytoscape/dagre/roughjs/khroma…），
  // d3/dayjs/uuid 等共享依赖交给 rolldown 按引用关系自动归并，避免重复打包。
  {
    name: "vendor-mermaid",
    test: /[\\/]node_modules[\\/](mermaid|@mermaid-js[\\/][^\\/]+|cytoscape|cytoscape-[^\\/]+|dagre-d3-es|roughjs|khroma|@braintree[\\/]sanitize-url|d3-sankey|@upsetjs[\\/]venn\.js|stylis|ts-dedent)[\\/]/,
    priority: 37,
    entriesAware: true,
  },
  // KaTeX（MathView 用 `await import("katex")` 懒加载；rehype-katex 走导出链）。
  // entriesAware:true 保住懒加载边界。
  {
    name: "vendor-katex",
    test: /[\\/]node_modules[\\/]katex[\\/]/,
    priority: 36,
    entriesAware: true,
  },
  // Markdown / HTML 序列化管线（unified / remark / rehype / micromark / mdast / hast /
  // markdown-it / lowlight / highlight.js / lowlight 解析）。
  // 该管线经 @/lib/export 被 stores 静态引用 → 仍是 eager，但单独命名成块便于缓存，
  // 把它从 7MB 兜底 vendor.js 里剥出来。
  {
    name: "vendor-markdown",
    test: /[\\/]node_modules[\\/](unified|remark-[^\\/]+|rehype-[^\\/]+|hast-[^\\/]+|hastscript|mdast-[^\\/]+|micromark|micromark-[^\\/]+|markdown-it|markdown-table|lowlight|highlight\.js|prosemirror-highlight|property-information|space-separated-tokens|comma-separated-tokens|decode-named-character-reference|character-entities[^\\/]*|trim-lines|trough|vfile|vfile-[^\\/]+|bail|is-plain-obj|zwitch|html-void-elements|web-namespaces|ccount|escape-string-regexp|mdurl|entities|linkify-it|uc\.micro|punycode\.js|devlop)[\\/]/,
    priority: 35,
  },
  // Prettier standalone + 插件（useFormatCode 用 `await import("prettier/standalone")` 懒加载）。
  // entriesAware:true 保住懒加载边界，否则 ~1MB prettier 被卷进 eager vendor.js。
  {
    name: "vendor-prettier",
    test: /[\\/]node_modules[\\/]prettier[\\/]/,
    priority: 34,
    entriesAware: true,
  },
  // 可视化（echarts 经 MarkdownArtifact 的 React.lazy 边界懒加载）。
  // entriesAware:true 保住懒加载边界，避免 1.1MB echarts 被卷进 eager vendor.js。
  {
    name: "vendor-echarts",
    test: /[\\/]node_modules[\\/](echarts|zrender)[\\/]/,
    priority: 25,
    entriesAware: true,
  },
  // 动画
  {
    name: "vendor-motion",
    test: /[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/,
    priority: 24,
  },
  // 拖拽
  {
    name: "vendor-dnd",
    test: /[\\/]node_modules[\\/]@dnd-kit[\\/]/,
    priority: 23,
  },
  // 路由
  {
    name: "vendor-router",
    test: /[\\/]node_modules[\\/](react-router|react-router-dom)[\\/]/,
    priority: 22,
  },
  // Radix + 自建 UI 原语 + 图标/命令面板
  {
    name: "vendor-ui",
    test: /[\\/]node_modules[\\/](@radix-ui[\\/][^\\/]+|@floating-ui[\\/][^\\/]+|lucide-react|cmdk|sonner|class-variance-authority|clsx|tailwind-merge|date-fns)[\\/]/,
    priority: 20,
  },
  // 兜底：其余 node_modules
  {
    name: "vendor",
    test: /[\\/]node_modules[\\/]/,
    priority: 1,
  },
];
