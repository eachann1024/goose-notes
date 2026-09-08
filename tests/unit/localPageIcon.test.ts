import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "playwright/test";
import {
  canCustomizePageIcon,
  shouldRenderExpandArrowSlot,
  shouldShowFolderExpandArrow,
} from "../../src/pages/workspace/components/sidebar/local-file-icon";
import {
  buildLocalFolderPickerItems,
  getPageContainingFolderId,
  getPageParentDirectoryId,
  isDescendantPage,
  resolveLocalFolderImportParentId,
} from "../../src/lib/local-folder-target";
import {
  loadPagesFromStorage,
  LOCAL_PAGE_META_DOC_PREFIX,
  saveLocalPageMeta,
} from "../../src/lib/storage/pageRepository";
import { localPageMetadataCache } from "../../src/stores/pages/persistence";
import { useNotebooks } from "../../src/stores/useNotebooks";
import { usePages } from "../../src/stores/usePages";
import { useSettings } from "../../src/stores/useSettings";
import { useSidebarView } from "../../src/stores/useSidebarView";
import type { Page } from "../../src/types";
import { installElectronLocalStorageRuntime } from "./electronLocalStorageRuntime";

const NOTEBOOK_ID = "vault-notebook";
const FILE_ID = "local-file-note";

function installDbRuntime() {
  return installElectronLocalStorageRuntime();
}

function localFilePage(overrides: Partial<Page> = {}): Page {
  const now = Date.now();
  return {
    id: FILE_ID,
    workspaceId: NOTEBOOK_ID,
    content: [{ type: "paragraph", content: "note" }] as any,
    isFolder: false,
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    localFilePath: "/notes/hello.md",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test.afterEach(() => {
  localPageMetadataCache.clear();
  delete (globalThis as any).window;
  usePages.setState({ pages: {}, activePageId: null });
  useNotebooks.setState({ notebooks: {}, activeNotebookId: null });
  useSettings.setState({ randomIconOnCreate: true });
  useSidebarView.setState({
    selectedByNotebook: {},
    expandedByNotebook: {},
    focusedByNotebook: {},
  });
});

test("侧栏文件图标固定 16px，避免 Lucide 默认 24 撑大收藏行", () => {
  const iconSource = readFileSync(
    resolve("src/pages/workspace/components/sidebar/local-file-icon.tsx"),
    "utf8",
  );
  expect(iconSource).toContain("size={16}");
  expect(iconSource).toMatch(/SelectedIcon[\s\S]*?size=\{16\}/);
});

test("Electron 图标选择器用扁平 :hover，避免旧内核吃不到 Tailwind 嵌套 hover", () => {
  const selector = readFileSync(
    resolve("src/pages/workspace/components/shared/IconSelector.tsx"),
    "utf8",
  );
  expect(selector).toContain(".goose-icon-selector button:hover");
  const workspaceCss = readFileSync(
    resolve("src/pages/workspace/styles/index.css"),
    "utf8",
  );
  expect(workspaceCss).toContain(".goose-page-icon-trigger:hover");
});

test("主树悬停用 --hovered 类而不是 :hover，才能压过 rct 的 transparent !important", () => {
  const css = readFileSync(
    resolve("src/pages/workspace/components/sidebar/main-tree/main-tree.css"),
    "utf8",
  );
  expect(css).toContain(".main-tree-row--hovered");
  expect(css).toContain(
    "background-color: var(--goose-interactive-selected) !important;",
  );
  expect(css).not.toMatch(/\.main-tree-row:hover\s*\{/);
  const item = readFileSync(
    resolve("src/pages/workspace/components/sidebar/main-tree/MainTreeItem.tsx"),
    "utf8",
  );
  expect(item).toContain("main-tree-row--hovered");
  expect(item).toContain("onPointerEnter");
});

test("本地仓库：文件可换图标，文件夹和待创建项不可以", () => {
  expect(
    canCustomizePageIcon({ isFolder: false }, true),
  ).toBe(true);
  expect(
    canCustomizePageIcon({ isFolder: true }, true),
  ).toBe(false);
  expect(
    canCustomizePageIcon({ isFolder: false, localPendingCreate: "file" }, true),
  ).toBe(false);
  expect(
    canCustomizePageIcon({ isFolder: true }, false),
  ).toBe(true);
});

test("本地仓库：空文件夹也显示展开箭头，文件不显示", () => {
  expect(
    shouldShowFolderExpandArrow({
      isFolder: true,
      hasChildren: false,
      isLocalNotebook: true,
    }),
  ).toBe(true);
  expect(
    shouldShowFolderExpandArrow({
      isFolder: true,
      hasChildren: true,
      isLocalNotebook: true,
    }),
  ).toBe(true);
  expect(
    shouldShowFolderExpandArrow({
      isFolder: false,
      hasChildren: false,
      isLocalNotebook: true,
    }),
  ).toBe(false);
  expect(
    shouldShowFolderExpandArrow({
      isFolder: false,
      hasChildren: true,
      isLocalNotebook: false,
    }),
  ).toBe(true);
  expect(
    shouldShowFolderExpandArrow({
      isFolder: true,
      hasChildren: false,
      isLocalNotebook: false,
    }),
  ).toBe(false);
});

test("收藏平铺列表不预留展开箭头槽", () => {
  expect(
    shouldRenderExpandArrowSlot({
      showExpandControls: false,
      hideExpandArrows: false,
    }),
  ).toBe(false);
  expect(
    shouldRenderExpandArrowSlot({
      showExpandControls: false,
      hideExpandArrows: true,
    }),
  ).toBe(false);
  expect(
    shouldRenderExpandArrowSlot({
      showExpandControls: true,
      hideExpandArrows: false,
    }),
  ).toBe(true);
  expect(
    shouldRenderExpandArrowSlot({
      showExpandControls: true,
      hideExpandArrows: true,
    }),
  ).toBe(false);
});

test("本地文件图标写入 gn:local-meta 并能读回", () => {
  const { docs } = installDbRuntime();
  expect(
    saveLocalPageMeta({
      id: FILE_ID,
      workspaceId: NOTEBOOK_ID,
      updatedAt: 1,
      icon: "Star",
    }),
  ).toBe(true);

  const stored = docs.get(`${LOCAL_PAGE_META_DOC_PREFIX}${FILE_ID}`);
  expect((stored?.data as { icon?: string } | undefined)?.icon).toBe("Star");

  const hydrated = loadPagesFromStorage();
  expect(hydrated.localPageMetas[FILE_ID]?.icon).toBe("Star");
});

test("updatePage 给本地文件换图标会持久化，移除后不再记住", () => {
  const { docs } = installDbRuntime();
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
    pages: { [FILE_ID]: localFilePage() },
  });

  usePages.getState().updatePage(FILE_ID, { icon: "Star" });
  expect(usePages.getState().pages[FILE_ID].icon).toBe("Star");
  expect(
    (docs.get(`${LOCAL_PAGE_META_DOC_PREFIX}${FILE_ID}`)?.data as { icon?: string })
      ?.icon,
  ).toBe("Star");

  usePages.getState().updatePage(FILE_ID, { icon: undefined });
  expect(usePages.getState().pages[FILE_ID].icon).toBeUndefined();
  expect(docs.has(`${LOCAL_PAGE_META_DOC_PREFIX}${FILE_ID}`)).toBe(false);
});

test("本地导入父目录：优先侧栏选中页父目录，其次当前页所在目录", () => {
  const folderId = "folder-a";
  const fileId = "file-a";
  const childFileId = "file-b";
  usePages.setState({
    pages: {
      [folderId]: localFilePage({
        id: folderId,
        isFolder: true,
        parentId: undefined,
        localFilePath: "/notes/A",
      }),
      [fileId]: localFilePage({
        id: fileId,
        parentId: folderId,
        localFilePath: "/notes/A/readme.md",
      }),
      [childFileId]: localFilePage({
        id: childFileId,
        parentId: folderId,
        localFilePath: "/notes/A/child.md",
      }),
    },
    activePageId: childFileId,
  });
  useSidebarView.setState({
    selectedByNotebook: { [NOTEBOOK_ID]: fileId },
  });

  expect(getPageParentDirectoryId(usePages.getState().pages[fileId]!)).toBe(
    folderId,
  );
  expect(
    getPageContainingFolderId(usePages.getState().pages[childFileId]!),
  ).toBe(folderId);
  expect(resolveLocalFolderImportParentId(NOTEBOOK_ID)).toBe(folderId);
});

test("移动到目标选择器会排除自身及子孙文件夹", () => {
  const rootFolder = "folder-root";
  const childFolder = "folder-child";
  usePages.setState({
    pages: {
      [rootFolder]: localFilePage({
        id: rootFolder,
        isFolder: true,
        parentId: undefined,
        localFilePath: "/notes/root",
      }),
      [childFolder]: localFilePage({
        id: childFolder,
        isFolder: true,
        parentId: rootFolder,
        localFilePath: "/notes/root/child",
      }),
    },
  });

  expect(
    isDescendantPage(
      usePages.getState().pages,
      rootFolder,
      childFolder,
    ),
  ).toBe(true);

  const items = buildLocalFolderPickerItems(
    usePages.getState().pages,
    NOTEBOOK_ID,
    {
      query: "",
      excludePageId: rootFolder,
      recentKeys: [],
    },
  );

  expect(items.some((item) => item.folderId === rootFolder)).toBe(false);
  expect(items.some((item) => item.folderId === childFolder)).toBe(false);
  expect(items.some((item) => item.key === "root")).toBe(true);
});

test("createLocalPageRecord 在 randomIconOnCreate 开启时写入随机图标", async () => {
  installDbRuntime();
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
  useSettings.setState({ randomIconOnCreate: true });

  const pageId = await usePages.getState().createLocalPageRecord({
    workspaceId: NOTEBOOK_ID,
    title: "随机图标",
    content: [{ type: "paragraph", content: "hello" }] as any,
  });

  expect(pageId).toBeTruthy();
  const created = usePages.getState().pages[pageId!];
  expect(created?.icon).toBeTruthy();
  expect(
    JSON.parse(
      (globalThis as any).window.localStorage.getItem("goose-note:web-db") ?? "{}",
    )[`${LOCAL_PAGE_META_DOC_PREFIX}${pageId}`]?.data?.icon,
  ).toBe(created?.icon);
});

