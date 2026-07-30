import { resolve } from "node:path";
import { copyFileSync, mkdirSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const guideImages = [
  "hero-rabbit-goose.webp",
  "search-highlight.webp",
  "create-anything.webp",
  "ai-and-safety.webp",
  "guide-og.png",
];

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "serve-guide-at-root",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const pathname = new URL(request.url ?? "/", "http://guide.local").pathname;
          if (pathname !== "/") {
            next();
            return;
          }
          response.statusCode = 302;
          response.setHeader("Location", "/guide.html");
          response.end();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((request, response, next) => {
          const pathname = new URL(request.url ?? "/", "http://guide.local").pathname;
          if (pathname !== "/") {
            next();
            return;
          }
          response.statusCode = 302;
          response.setHeader("Location", "/guide.html");
          response.end();
        });
      },
    },
    {
      name: "copy-guide-images",
      closeBundle() {
        const outputDir = resolve(__dirname, "dist-guide/guide/images");
        mkdirSync(outputDir, { recursive: true });
        for (const image of guideImages) {
          copyFileSync(
            resolve(__dirname, "public/guide/images", image),
            resolve(outputDir, image),
          );
        }
      },
    },
    react(),
  ],
  publicDir: false,
  build: {
    outDir: "dist-guide",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "guide.html"),
    },
  },
});
