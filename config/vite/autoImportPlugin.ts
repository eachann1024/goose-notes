import path from "node:path";
import type { Plugin, PluginOption } from "vite";
import AutoImport from "unplugin-auto-import/vite";
import { autoImportEntries } from "./autoImportEntries";
import { autoImportPackages } from "./autoImportPackages";
import { generateAutoImportDeclarations } from "./autoImportDeclarations";

function createDeclarationPlugin(): Plugin {
  let root = process.cwd();
  let generation = Promise.resolve();
  const generate = () => {
    generation = generation
      .catch(() => undefined)
      .then(() => generateAutoImportDeclarations(root));
    return generation;
  };
  return {
    name: "goose-auto-import-declarations",
    configResolved(config) {
      root = config.root;
    },
    buildStart: generate,
    buildEnd: generate,
    configureServer(server) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onSourceChange = (file: string) => {
        const relative = path.relative(root, file).replaceAll("\\", "/");
        if (
          !relative.startsWith("src/") ||
          !/\.tsx?$/.test(relative) ||
          relative.endsWith(".d.ts")
        )
          return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          void generate().catch((error) =>
            server.config.logger.error(String(error)),
          );
        }, 100);
      };
      server.watcher
        .on("change", onSourceChange)
        .on("add", onSourceChange)
        .on("unlink", onSourceChange);
      server.httpServer?.once("close", () => {
        clearTimeout(timer);
        server.watcher
          .off("change", onSourceChange)
          .off("add", onSourceChange)
          .off("unlink", onSourceChange);
      });
    },
  };
}

export function createAutoImportPlugins(): PluginOption[] {
  return [
    AutoImport({
      imports: [autoImportPackages],
      dirs: autoImportEntries,
      dts: false,
    }),
    createDeclarationPlugin(),
  ];
}
