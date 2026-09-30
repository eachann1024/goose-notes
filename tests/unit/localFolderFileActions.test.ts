import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import {
  LOCAL_FOLDER_FILE_SHORTCUTS,
  hasCurrentLocalFolderPage,
  resolveCurrentLocalFolderPage,
} from "../../src/lib/local-folder-file-actions";
import { matchShortcut } from "../../src/lib/shortcut-match";
import { getAllConfiguredShortcuts } from "../../src/pages/workspace/components/sidebar/settings/SettingsShortcuts";
import { normalizeShortcutForConflict } from "../../src/lib/shortcut-platform";
import { useNotebooks } from "../../src/stores/useNotebooks";
import { usePages } from "../../src/stores/usePages";
import { useSidebarView } from "../../src/stores/useSidebarView";
import type { Page } from "../../src/types";

const NOTEBOOK_ID = "local-file-actions-notebook";
const FILE_ID = "local-file-actions-note";
const OTHER_ID = "local-file-actions-other";

function localFilePage(overrides: Partial<Page> = {}): Page {
  return {
    id: FILE_ID,
    workspaceId: NOTEBOOK_ID,
    content: [{ type: "paragraph", content: "note" }] as Page["content"],
    isFolder: false,
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    localFilePath: "/notes/hello.md",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function resetStores() {
  usePages.setState({ pages: {}, activePageId: null });
  useNotebooks.setState({ notebooks: {}, activeNotebookId: null });
  useSidebarView.setState({
    selectedByNotebook: {},
    expandedByNotebook: {},
    focusedByNotebook: {},
  });
}

test.beforeEach(() => {
  resetStores();
});

test.afterEach(() => {
  resetStores();
});

test("本地文件操作默认快捷键固定，复制当前文件路径为 Mod+Shift+C", () => {
  expect(LOCAL_FOLDER_FILE_SHORTCUTS.openInExternalApp).toBe("Mod+Shift+A");
  expect(LOCAL_FOLDER_FILE_SHORTCUTS.revealInFileManager).toBe("Mod+Shift+F");
  expect(LOCAL_FOLDER_FILE_SHORTCUTS.openInTerminal).toBe("Ctrl+`");
  expect(LOCAL_FOLDER_FILE_SHORTCUTS.copyFilePath).toBe("Mod+Shift+C");
  expect(LOCAL_FOLDER_FILE_SHORTCUTS.moveItem).toBe("Mod+Shift+M");
});

test("固定快捷键占用包含本地文件打开/复制默认键", () => {
  const configured = getAllConfiguredShortcuts({}, "", "", "unused", true);
  for (const shortcut of Object.values(LOCAL_FOLDER_FILE_SHORTCUTS)) {
    expect(configured).toContain(normalizeShortcutForConflict(shortcut, true));
  }
});

test("Ctrl+` 能匹配 Backquote 键", () => {
  expect(
    matchShortcut(
      {
        key: "`",
        code: "Backquote",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      } as KeyboardEvent,
      LOCAL_FOLDER_FILE_SHORTCUTS.openInTerminal,
    ),
  ).toBe(true);
  expect(
    matchShortcut(
      {
        key: "Dead",
        code: "Backquote",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      } as KeyboardEvent,
      LOCAL_FOLDER_FILE_SHORTCUTS.openInTerminal,
    ),
  ).toBe(true);
});

test("当前本地文件优先侧栏选中，否则用正在打开的页面", () => {
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
  usePages.setState({
    pages: {
      [FILE_ID]: localFilePage(),
      [OTHER_ID]: localFilePage({
        id: OTHER_ID,
        localFilePath: "/notes/other.md",
      }),
    },
    activePageId: FILE_ID,
  });

  expect(resolveCurrentLocalFolderPage()?.id).toBe(FILE_ID);

  useSidebarView.setState({
    selectedByNotebook: { [NOTEBOOK_ID]: OTHER_ID },
  });
  expect(resolveCurrentLocalFolderPage()?.id).toBe(OTHER_ID);
  expect(hasCurrentLocalFolderPage()).toBe(true);
});

test("非本地文件夹或已删除页面不能作为当前文件", () => {
  useNotebooks.setState({
    notebooks: {
      [NOTEBOOK_ID]: {
        id: NOTEBOOK_ID,
        name: "Notes",
        createdAt: 1,
        updatedAt: 1,
      },
    },
    activeNotebookId: NOTEBOOK_ID,
  });
  usePages.setState({
    pages: { [FILE_ID]: localFilePage() },
    activePageId: FILE_ID,
  });
  expect(resolveCurrentLocalFolderPage()).toBeNull();

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
  usePages.setState({
    pages: { [FILE_ID]: localFilePage({ trashedAt: 2 }) },
    activePageId: FILE_ID,
  });
  expect(hasCurrentLocalFolderPage()).toBe(false);
});

test("侧栏右键菜单和热键都引用同一套本地文件快捷键", () => {
  const menu = readFileSync(
    "src/pages/workspace/components/sidebar/SidebarContextMenu.tsx",
    "utf8",
  );
  const hotkeys = readFileSync("src/hooks/useAppHotkeys.ts", "utf8");
  const settings = readFileSync(
    "src/pages/workspace/components/sidebar/settings/SettingsShortcuts.tsx",
    "utf8",
  );
  expect(menu).toContain("LOCAL_FOLDER_FILE_SHORTCUTS.copyFilePath");
  expect(menu).toContain("LOCAL_FOLDER_FILE_SHORTCUTS.openInExternalApp");
  expect(menu).toContain("LOCAL_FOLDER_FILE_SHORTCUTS.revealInFileManager");
  expect(menu).toContain("LOCAL_FOLDER_FILE_SHORTCUTS.openInTerminal");
  expect(menu).toContain("getFixedAppShortcuts().newNote");
  expect(hotkeys).toContain("LOCAL_FOLDER_FILE_SHORTCUTS.copyFilePath");
  expect(settings).toContain("复制当前文件路径");
});
