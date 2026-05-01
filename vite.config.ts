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
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-tooltip",
      "lucide-react",
    ],
  ],
  ["vendor-blocknote", ["@blocknote/core", "@blocknote/react"]],
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
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@host-runtime": path.resolve(__dirname, "./src/lib/host/runtime.utools.ts"),
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: resolveVendorChunk,
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
