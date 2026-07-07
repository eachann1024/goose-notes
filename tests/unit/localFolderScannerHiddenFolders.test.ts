import { expect, test } from "playwright/test";
import { scanLocalFolderPages } from "../../src/lib/local-folder-scanner";
import type { GooseFs } from "../../src/types";

test.afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  globalThis.localStorage?.clear();
});

function installMockWindowStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
  (globalThis as { window?: unknown }).window = { localStorage };
}

function buildMockGooseFs(entries: {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  path: string;
}[]): GooseFs {
  return {
    readDirAsync: async (dirPath: string) => (dirPath === "/mock" ? entries : []),
    readDir: (dirPath: string) => (dirPath === "/mock" ? entries : []),
    readFileStatAsync: async () => ({
      ok: false,
      content: null,
      error: "mock read skipped",
    }),
  } as unknown as GooseFs;
}

function pageNamesFromLocalPaths(pages: { localFilePath?: string }[]) {
  return pages
    .map((page) => page.localFilePath?.replace(/^.*[\\/]/, ""))
    .filter(Boolean);
}

test("scanLocalFolderPages hides default assets folder", async () => {
  installMockWindowStorage();
  const notebookId = "test-nb";
  const basePath = "/mock";

  const pages = await scanLocalFolderPages({
    notebookId,
    basePath,
    gooseFs: buildMockGooseFs([
      { name: "note.md", isFile: true, isDirectory: false, path: `${basePath}/note.md` },
      { name: "assets", isFile: false, isDirectory: true, path: `${basePath}/assets` },
      { name: "obsidian", isFile: false, isDirectory: true, path: `${basePath}/obsidian` },
    ]),
    hiddenFolders: ["assets"],
  });

  const names = pageNamesFromLocalPaths(pages);
  expect(names).toContain("note.md");
  expect(names).toContain("obsidian");
  expect(names).not.toContain("assets");
});

test("scanLocalFolderPages hides custom folders", async () => {
  installMockWindowStorage();
  const notebookId = "test-nb";
  const basePath = "/mock";

  const pages = await scanLocalFolderPages({
    notebookId,
    basePath,
    gooseFs: buildMockGooseFs([
      { name: "note.md", isFile: true, isDirectory: false, path: `${basePath}/note.md` },
      { name: "assets", isFile: false, isDirectory: true, path: `${basePath}/assets` },
      { name: "obsidian", isFile: false, isDirectory: true, path: `${basePath}/obsidian` },
    ]),
    hiddenFolders: ["assets", "obsidian"],
  });

  const names = pageNamesFromLocalPaths(pages);
  expect(names).toContain("note.md");
  expect(names).not.toContain("assets");
  expect(names).not.toContain("obsidian");
});

test("scanLocalFolderPages shows folders when hidden list is empty", async () => {
  installMockWindowStorage();
  const notebookId = "test-nb";
  const basePath = "/mock";

  const pages = await scanLocalFolderPages({
    notebookId,
    basePath,
    gooseFs: buildMockGooseFs([
      { name: "note.md", isFile: true, isDirectory: false, path: `${basePath}/note.md` },
      { name: "assets", isFile: false, isDirectory: true, path: `${basePath}/assets` },
    ]),
    hiddenFolders: [],
  });

  const names = pageNamesFromLocalPaths(pages);
  expect(names).toContain("note.md");
  expect(names).toContain("assets");
});
