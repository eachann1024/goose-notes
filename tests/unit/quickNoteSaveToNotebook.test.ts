import { expect, test } from "playwright/test";
import { UNTITLED_PAGE_TITLE } from "../../src/components/editor/utils/page-title";
import { createEmptySlotStacks } from "../../src/lib/quicknote/undoHistory";
import { useNotebooks } from "../../src/stores/useNotebooks";
import { usePages } from "../../src/stores/usePages";
import {
  createEmptyQuickNoteDrafts,
  extractQuickNoteDraftTitle,
  useQuickNote,
} from "../../src/stores/useQuickNote";
import type { JSONContent } from "../../src/types";
import { installElectronLocalStorageRuntime } from "./electronLocalStorageRuntime";

const NOTEBOOK_ID = "vault-notebook";

function paragraph(text: string): JSONContent {
  return [
    { type: "paragraph", content: [{ type: "text", text }] },
  ] as JSONContent;
}

function resetStores() {
  useQuickNote.setState({
    activeSlot: 1,
    drafts: createEmptyQuickNoteDrafts(),
    undoStacks: createEmptySlotStacks(),
    redoStacks: createEmptySlotStacks(),
  });
  usePages.setState({ pages: {}, activePageId: null });
  useNotebooks.setState({ notebooks: {}, activeNotebookId: null });
}

test.afterEach(() => {
  resetStores();
  delete (globalThis as any).window;
});

test("extractQuickNoteDraftTitle 取第一行可见文字，空稿回退未命名", () => {
  expect(extractQuickNoteDraftTitle(null)).toBe(UNTITLED_PAGE_TITLE);
  expect(extractQuickNoteDraftTitle(paragraph("  会议纪要\n第二行"))).toBe(
    "会议纪要",
  );
  expect(
    extractQuickNoteDraftTitle([
      { type: "paragraph", content: [] },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "要点" }],
      },
    ] as JSONContent),
  ).toBe("要点");
});

test("空白草稿不会写入笔记本", async () => {
  installElectronLocalStorageRuntime();
  resetStores();
  useNotebooks.setState({
    notebooks: {
      [NOTEBOOK_ID]: {
        id: NOTEBOOK_ID,
        name: "Vault",
        source: "local-folder",
        localPath: "/notes",
        createdAt: 1,
        updatedAt: 1,
      },
    },
    activeNotebookId: NOTEBOOK_ID,
  });

  const id = await useQuickNote.getState().saveDraftToNotebook();
  expect(id).toBeNull();
  expect(Object.keys(usePages.getState().pages)).toHaveLength(0);
});

test("保存到当前本地笔记本会新建文件并清空草稿", async () => {
  installElectronLocalStorageRuntime();
  resetStores();
  const files = new Map<string, string>();
  (globalThis as any).window.gooseFs = {
    writeFile: (path: string, value: string) => {
      files.set(path, value);
      return true;
    },
    writeFileAsync: async (path: string, value: string) => {
      files.set(path, value);
      return true;
    },
    exists: () => false,
    existsAsync: async () => false,
  };

  useNotebooks.setState({
    notebooks: {
      [NOTEBOOK_ID]: {
        id: NOTEBOOK_ID,
        name: "Vault",
        source: "local-folder",
        localPath: "/notes",
        createdAt: 1,
        updatedAt: 1,
      },
    },
    activeNotebookId: NOTEBOOK_ID,
  });
  useQuickNote.setState({
    activeSlot: 1,
    drafts: {
      ...createEmptyQuickNoteDrafts(),
      1: paragraph("会议纪要"),
    },
    undoStacks: {
      ...createEmptySlotStacks(),
      1: [null],
    },
    redoStacks: {
      ...createEmptySlotStacks(),
      1: [paragraph("旧稿")],
    },
  });

  const id = await useQuickNote.getState().saveDraftToNotebook();
  expect(id).toBeTruthy();
  const created = usePages.getState().pages[id!];
  expect(created?.workspaceId).toBe(NOTEBOOK_ID);
  expect(created?.localFilePath).toBe("/notes/会议纪要.md");
  expect(files.has("/notes/会议纪要.md")).toBe(true);

  const draft = useQuickNote.getState();
  expect(draft.drafts[1]).toBeNull();
  expect(draft.undoStacks[1]).toEqual([]);
  expect(draft.redoStacks[1]).toEqual([]);
});

test("没有当前笔记本时不改草稿", async () => {
  installElectronLocalStorageRuntime();
  resetStores();
  useQuickNote.setState({
    drafts: {
      ...createEmptyQuickNoteDrafts(),
      1: paragraph("还在便签里"),
    },
  });

  const id = await useQuickNote.getState().saveDraftToNotebook();
  expect(id).toBeNull();
  expect(useQuickNote.getState().drafts[1]).toEqual(paragraph("还在便签里"));
  expect(Object.keys(usePages.getState().pages)).toHaveLength(0);
});
