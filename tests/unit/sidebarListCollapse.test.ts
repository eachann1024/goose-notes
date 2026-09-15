import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import {
  armSidebarListCollapse,
  collapseAllSidebarExpandedPages,
  collectSidebarRevealAncestorIds,
  computeSidebarEscapeExpandedIds,
  isSidebarListCollapseArmed,
  isSidebarPageListTarget,
  resolveSidebarCollapseTargetId,
  shouldCollapseSidebarListOnEscape,
  tryCollapseSidebarListOnEscape,
  type SidebarCollapsePage,
} from "../../src/lib/sidebarListCollapse";
import { usePages } from "../../src/stores/usePages";
import { useSidebarView } from "../../src/stores/useSidebarView";

const NOTEBOOK_ID = "nb-1";

test.beforeEach(() => {
  armSidebarListCollapse(null);
  useSidebarView.setState({
    expandedByNotebook: {},
    focusedByNotebook: {},
    selectedByNotebook: {},
  });
  usePages.setState({ activePageId: null, expandPageId: null });
});

function fakeTreeNode() {
  return {
    closest: (selector: string) =>
      selector.includes(".rct-main-tree") ? {} : null,
  };
}

function fakeInputInTree() {
  return {
    closest: (selector: string) =>
      selector.includes("input") ? {} : selector.includes(".rct-main-tree") ? {} : null,
  };
}

test("isSidebarPageListTarget 认页面树，忽略输入框", () => {
  expect(isSidebarPageListTarget(fakeTreeNode() as EventTarget)).toBe(true);
  expect(isSidebarPageListTarget(fakeInputInTree() as EventTarget)).toBe(false);
  expect(isSidebarPageListTarget(null)).toBe(false);
});

test("点击页面树后武装 Esc 收起，点别处解除", () => {
  armSidebarListCollapse(fakeTreeNode() as EventTarget);
  expect(isSidebarListCollapseArmed()).toBe(true);
  armSidebarListCollapse({ closest: () => null } as unknown as EventTarget);
  expect(isSidebarListCollapseArmed()).toBe(false);
});

function page(
  id: string,
  parentId?: string,
  extra?: Partial<SidebarCollapsePage>,
): SidebarCollapsePage {
  return { id, parentId, workspaceId: NOTEBOOK_ID, ...extra };
}

test("collapseAllSidebarExpandedPages 无选中页时收起全部", () => {
  useSidebarView.getState().setExpanded(NOTEBOOK_ID, ["a", "b"]);
  expect(collapseAllSidebarExpandedPages(NOTEBOOK_ID)).toBe(true);
  expect(useSidebarView.getState().expandedByNotebook[NOTEBOOK_ID]).toEqual([]);
  expect(collapseAllSidebarExpandedPages(NOTEBOOK_ID)).toBe(false);
});

test("resolveSidebarCollapseTargetId 优先选中行，跳过回收站和待创建", () => {
  const pages = {
    selected: page("selected"),
    focused: page("focused"),
    active: page("active"),
    trashed: page("trashed", undefined, { trashedAt: 1 }),
    pending: page("pending", undefined, { localPendingCreate: "file" }),
  };
  expect(
    resolveSidebarCollapseTargetId(NOTEBOOK_ID, {
      selectedId: "trashed",
      focusedId: "pending",
      activePageId: "active",
      pages,
    }),
  ).toBe("active");
  expect(
    resolveSidebarCollapseTargetId(NOTEBOOK_ID, {
      selectedId: "selected",
      focusedId: "focused",
      activePageId: "active",
      pages,
    }),
  ).toBe("selected");
});

test("collectSidebarRevealAncestorIds 只收祖先、遇环和已删父级即停", () => {
  const pages = {
    rootNote: page("rootNote"),
    folder: page("folder"),
    nested: page("nested", "folder"),
    deep: page("deep", "nested"),
    orphan: page("orphan", "missing"),
    loopA: page("loopA", "loopB"),
    loopB: page("loopB", "loopA"),
    childOfTrash: page("childOfTrash", "trashedFolder"),
    trashedFolder: page("trashedFolder", undefined, { trashedAt: 1 }),
  };
  expect(collectSidebarRevealAncestorIds(pages, "deep", NOTEBOOK_ID)).toEqual([
    "nested",
    "folder",
  ]);
  expect(collectSidebarRevealAncestorIds(pages, "rootNote", NOTEBOOK_ID)).toEqual(
    [],
  );
  expect(collectSidebarRevealAncestorIds(pages, "orphan", NOTEBOOK_ID)).toEqual(
    [],
  );
  expect(collectSidebarRevealAncestorIds(pages, "loopA", NOTEBOOK_ID)).toEqual([
    "loopB",
  ]);
  expect(
    collectSidebarRevealAncestorIds(pages, "childOfTrash", NOTEBOOK_ID),
  ).toEqual([]);
});

test("computeSidebarEscapeExpandedIds 收起其它文件夹并展开当前笔记祖先", () => {
  const pages = {
    keep: page("keep"),
    current: page("current", "keep"),
    other: page("other"),
    otherChild: page("otherChild", "other"),
  };
  const result = computeSidebarEscapeExpandedIds({
    notebookId: NOTEBOOK_ID,
    expandedIds: ["keep", "other", "current"],
    selectedId: "current",
    pages,
  });
  expect(result.ids).toEqual(["keep"]);
  expect(result.changed).toBe(true);
  expect(result.revealId).toBe("current");
});

test("computeSidebarEscapeExpandedIds 当前笔记已可见则不改动", () => {
  const pages = {
    keep: page("keep"),
    current: page("current", "keep"),
  };
  const result = computeSidebarEscapeExpandedIds({
    notebookId: NOTEBOOK_ID,
    expandedIds: ["keep"],
    selectedId: "current",
    pages,
  });
  expect(result.changed).toBe(false);
  expect(result.ids).toEqual(["keep"]);
});

test("computeSidebarEscapeExpandedIds 祖先未展开时会补开", () => {
  const pages = {
    keep: page("keep"),
    current: page("current", "keep"),
  };
  const result = computeSidebarEscapeExpandedIds({
    notebookId: NOTEBOOK_ID,
    expandedIds: [],
    activePageId: "current",
    pages,
  });
  expect(result.ids).toEqual(["keep"]);
  expect(result.changed).toBe(true);
});

test("shouldCollapseSidebarListOnEscape 只在武装或焦点在列表时认 Esc", () => {
  expect(shouldCollapseSidebarListOnEscape({ key: "Escape" })).toBe(false);
  armSidebarListCollapse(fakeTreeNode() as EventTarget);
  expect(shouldCollapseSidebarListOnEscape({ key: "Escape" })).toBe(true);
  expect(
    shouldCollapseSidebarListOnEscape({ key: "Escape", shiftKey: true }),
  ).toBe(false);
  expect(shouldCollapseSidebarListOnEscape({ key: "Enter" })).toBe(false);
});

test("tryCollapseSidebarListOnEscape 在页面列表武装后收起展开项", () => {
  useSidebarView.getState().setExpanded(NOTEBOOK_ID, ["folder"]);
  armSidebarListCollapse(fakeTreeNode() as EventTarget);
  expect(tryCollapseSidebarListOnEscape({ key: "Escape" }, NOTEBOOK_ID)).toBe(
    true,
  );
  expect(useSidebarView.getState().expandedByNotebook[NOTEBOOK_ID]).toEqual([]);
});

test("快捷键页列出侧栏收起，副作用挂在侧栏键盘处理", () => {
  const shortcuts = readFileSync(
    new URL(
      "../../src/pages/workspace/components/sidebar/settings/SettingsShortcuts.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const effects = readFileSync(
    new URL(
      "../../src/pages/workspace/components/sidebar/hooks/useSidebarEffects.ts",
      import.meta.url,
    ),
    "utf8",
  );
  expect(shortcuts).toContain("收起侧栏其它文件夹（当前选中笔记保持可见）");
  expect(shortcuts).toContain('shortcut: "Escape"');
  expect(effects).toContain("tryCollapseSidebarListOnEscape");
  expect(effects).toContain("armSidebarListCollapse");
});
