import { expect, test } from "playwright/test";
import type { Page } from "../../src/types";
import { fileStorage } from "../../src/lib/fileStorage";
import { useNotebooks } from "../../src/stores/useNotebooks";
import { usePages } from "../../src/stores/usePages";

const NOTEBOOK_ID = "local-file-storage-notebook";
const ROOT = "/tmp/goose-file-storage";
const PAGE_ID = "local-file-page";
const PAGE_PATH = `${ROOT}/note.md`;

function installLocalFolderEnvironment() {
  const files = new Map<string, string>();
  const directories = new Set<string>([ROOT]);
  const writes: Array<{ path: string; content: string; encoding?: string }> = [];

  const gooseFs: GooseFs = {
    readDir: () => [],
    readFile: (path) => files.get(path) ?? null,
    readFileAsync: async (path) => files.get(path) ?? null,
    readFileBase64: (path) => files.get(path) ?? null,
    readFileBase64Async: async (path) => files.get(path) ?? null,
    writeFile: (path, value, encoding) => {
      writes.push({ path, content: value, encoding });
      files.set(path, value);
      return true;
    },
    writeFileAsync: async (path, value, encoding) => {
      writes.push({ path, content: value, encoding });
      files.set(path, value);
      return true;
    },
    exists: (path) => files.has(path) || directories.has(path),
    existsAsync: async (path) => files.has(path) || directories.has(path),
    watch: () => null,
    unwatch: () => undefined,
    mkdir: (path) => {
      directories.add(path);
      return true;
    },
    deleteFile: async (path) => files.delete(path),
    deleteDir: async (path) => directories.delete(path),
    rename: () => false,
  };

  (globalThis as { window?: unknown }).window = {
    gooseFs,
    dispatchEvent: () => true,
  };

  const page: Page = {
    id: PAGE_ID,
    workspaceId: NOTEBOOK_ID,
    content: [],
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    localFilePath: PAGE_PATH,
    createdAt: 1,
    updatedAt: 1,
  };

  useNotebooks.setState({
    notebooks: {
      [NOTEBOOK_ID]: {
        id: NOTEBOOK_ID,
        name: "本地附件测试",
        source: "local-folder",
        localPath: ROOT,
        createdAt: 1,
        updatedAt: 1,
      },
    },
    activeNotebookId: NOTEBOOK_ID,
  });
  usePages.setState({
    pages: { [PAGE_ID]: page },
    activePageId: PAGE_ID,
  });

  return { files, writes, gooseFs };
}

test.afterEach(() => {
  usePages.setState({ pages: {}, activePageId: null });
  useNotebooks.setState({ notebooks: {}, activeNotebookId: null });
  delete (globalThis as { window?: unknown }).window;
});

test("fileStorage.save writes local-folder attachments under page assets", async () => {
  const { writes } = installLocalFolderEnvironment();
  const file = new File(["hello world"], "report.pdf", {
    type: "application/pdf",
  });

  const saved = await fileStorage.save(file);

  expect(saved.storageRef).toMatch(/^\.\/assets\/file_\d+_[a-f0-9]{8}\.pdf$/);
  expect(saved.fileName).toBe("report.pdf");
  expect(saved.mimeType).toBe("application/pdf");
  expect(saved.size).toBe(file.size);

  const assetWrite = writes.find((write) => write.path.includes("/assets/file_"));
  expect(assetWrite).toMatchObject({
    path: `${ROOT}/assets/${saved.storageRef.replace("./assets/", "")}`,
    encoding: "base64",
    content: btoa("hello world"),
  });
});

test("fileStorage.load reads local-folder attachments from disk", async () => {
  const { files } = installLocalFolderEnvironment();
  const assetPath = `${ROOT}/assets/file_test_12345678.txt`;
  files.set(assetPath, btoa("disk payload"));

  const blob = await fileStorage.load("./assets/file_test_12345678.txt", PAGE_PATH);
  expect(blob).not.toBeNull();
  expect(await blob!.text()).toBe("disk payload");
});

test("fileStorage.delete removes local-folder attachments from disk", async () => {
  const { files } = installLocalFolderEnvironment();
  const assetPath = `${ROOT}/assets/file_test_deadbeef.bin`;
  files.set(assetPath, btoa("remove me"));

  await fileStorage.delete("./assets/file_test_deadbeef.bin", PAGE_PATH);

  expect(files.has(assetPath)).toBe(false);
});

test("fileStorage.save rejects paths outside notebook root", async () => {
  installLocalFolderEnvironment();
  useNotebooks.setState({
    notebooks: {
      [NOTEBOOK_ID]: {
        id: NOTEBOOK_ID,
        name: "本地附件测试",
        source: "local-folder",
        localPath: `${ROOT}/nested-root`,
        createdAt: 1,
        updatedAt: 1,
      },
    },
    activeNotebookId: NOTEBOOK_ID,
  });

  await expect(
    fileStorage.save(new File(["x"], "outside.txt", { type: "text/plain" })),
  ).rejects.toThrow("附件保存路径超出笔记本目录");
});
