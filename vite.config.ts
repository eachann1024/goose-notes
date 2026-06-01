import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import AutoImport from "unplugin-auto-import/vite";
import { codeInspectorPlugin } from "code-inspector-plugin";

const hostTarget = "utools";
const vendorChunkGroups: Array<[string, string[]]> = [
  ["vendor-react", ["react", "react-dom", "zustand"]],
  [
    "vendor-ui",
    [
      "@radix-ui/react-context-menu",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toggle",
      "@radix-ui/react-tooltip",
      "lucide-react",
      "cmdk",
      "sonner",
    ],
  ],
  [
    "vendor-blocknote",
    [
      "@blocknote/core",
      "@blocknote/react",
      "prosemirror-transform",
      "prosemirror-state",
      "prosemirror-view",
      "prosemirror-model",
    ],
  ],
  // AI SDK — 较大，单独隔离方便缓存
  ["vendor-ai", ["ai", "@ai-sdk/anthropic", "@ai-sdk/openai-compatible"]],
  // 可视化
  ["vendor-echarts", ["echarts"]],
  // 动画
  ["vendor-motion", ["framer-motion"]],
  // 文档导出（docx / pdf / zip）
  [
    "vendor-export",
    ["docx", "jszip", "@blocknote/xl-pdf-exporter", "@react-pdf/renderer"],
  ],
  // 拖拽
  ["vendor-dnd", ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"]],
  // 路由
  ["vendor-router", ["react-router-dom"]],
  // JSON 渲染
  ["vendor-json-render", ["@json-render/core", "@json-render/react"]],
];

function resolveVendorChunk(id: string) {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  return vendorChunkGroups.find(([, packages]) =>
    packages.some((pkg) => id.includes(`node_modules/${pkg}/`)),
  )?.[0];
}

// https://vite.dev/config/
export default defineConfig({
  base: "./", // utools 需要相对路径
  define: {
    __HOST_TARGET__: JSON.stringify(hostTarget),
  },
  plugins: [
    codeInspectorPlugin({
      bundler: "vite",
      hideConsole: true,
      hideDomPathAttr: true,
    }),
    react(),
    AutoImport({
      imports: [
        "react",
        {
          "lucide-react": [["*", "LucideIcons"]],
          clsx: ["clsx"],
        },
      ],
      dts: "src/auto-imports.d.ts",
      dirs: [
        "src/hooks",
        "src/stores",
        "src/lib",
        "src/components/ui",
        // 编辑器抽取后，原 src/lib / src/hooks 下被全 app 依赖的纯工具/hooks
        // 迁入此处，仍需保持自动导入以维持既有的全局符号（行为不变）。
        // 排除 cn.ts：编辑器自带的 cn 仅供编辑器内部显式 import，
        // 不进全局命名空间（全局 cn 仍由 src/lib/utils.ts 提供，行为不变）。
        "src/components/editor/utils",
        "!src/components/editor/utils/cn.ts",
        "src/components/editor/hooks",
      ],
    }),
    {
      name: "api-icon-middleware",
      configureServer(server) {
        server.middlewares.use("/api/icon", async (req, res) => {
          try {
            const urlObj = new URL(req.url || "", `http://${req.headers.host}`);
            const targetUrl = urlObj.searchParams.get("url");

            if (!targetUrl) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Missing url parameter" }));
              return;
            }

            const response = await fetch(targetUrl, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
              },
            });
            const html = await response.text();
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            const title = titleMatch ? titleMatch[1].trim() : new URL(targetUrl).hostname;

            const domain = new URL(targetUrl).hostname;
            const icon = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ title, icon }));
          } catch (error) {
            console.error("API Error:", error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Failed to fetch metadata" }));
          }
        });
      },
    },
  ],
  resolve: {
    dedupe: [
      "prosemirror-model",
      "prosemirror-state",
      "prosemirror-transform",
      "prosemirror-view",
      "prosemirror-tables",
    ],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@host-runtime": path.resolve(__dirname, "./src/lib/host/runtime.utools.ts"),
    },
  },
  server: {
    sourcemapIgnoreList: false,
  },

  build: {
    sourcemap: "hidden",
    rollupOptions: {
      output: {
        manualChunks: resolveVendorChunk,
        sourcemapIgnoreList: false,
        chunkFileNames: "chunks/[name].js",
        entryFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
      onwarn(warning, warn) {
        if (warning.code === "INEFFECTIVE_DYNAMIC_IMPORT") return;
        warn(warning);
      },
    },
    chunkSizeWarningLimit: 3000,
    reportCompressedSize: false,
  },
  logLevel: "warn",
});
