import { expect, test } from "playwright/test";
import { resolveHistoryBackend } from "../../src/lib/history/backend";
import { usePages } from "../../src/stores/usePages";
import { useNotebooks } from "../../src/stores/useNotebooks";
import { DiskWriteError } from "../../src/lib/diskWriteError";

const pageId = "hist-local-page";
const workspaceId = "hist-local-ws";

test.afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

test("本地文件夹历史写入失败时抛出 DiskWriteError", async () => {
  (globalThis as any).window = {
    gooseFs: {
      exists: () => true,
      existsAsync: async () => true,
      mkdir: async () => true,
      writeFile: () => false,
      writeFileAsync: async () => false,
      readFile: () => null,
      readFileAsync: async () => null,
    },
  };
  usePages.setState({
    pages: {
      [pageId]: {
        id: pageId,
        workspaceId,
        isFolder: false,
        isLocked: false,
        fontSize: "default",
        fontFamily: "default",
        content: [{ type: "paragraph", content: "x" }],
        createdAt: 0,
        updatedAt: 0,
        localFilePath: "/vault/note.md",
      },
    },
  } as any);
  useNotebooks.setState({
    notebooks: {
      [workspaceId]: {
        id: workspaceId,
        name: "vault",
        source: "local-folder",
        localPath: "/vault",
      },
    },
  } as any);

  const backend = resolveHistoryBackend(pageId);
  let thrown: unknown;
  try {
    await backend.saveVersion({
      versionId: "v1",
      pageId,
      workspaceId,
      createdAt: 1,
      trigger: "idle",
      isMilestone: false,
      charCount: 1,
      charDelta: 1,
      size: 1,
      content: [{ type: "paragraph", content: "x" }] as any,
    });
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(DiskWriteError);
});
