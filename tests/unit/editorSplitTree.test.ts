import { expect, test } from "playwright/test";
import {
  closeLeaf,
  countLeaves,
  createSingleLeafState,
  findLeaf,
  neighborLeaf,
  splitLeaf,
  toggleZoom,
  walkLeaves,
} from "../../src/lib/editor-split/tree";
import type { SplitLeaf, SplitState } from "../../src/lib/editor-split/types";

function leafByPage(state: SplitState, pageId: string): SplitLeaf {
  const leaf = walkLeaves(state.root).find((item) => item.pageId === pageId);
  if (!leaf) throw new Error(`missing leaf page ${pageId}`);
  return leaf;
}

function mustSplit(state: SplitState, direction: "right" | "down", pageId: string) {
  const result = splitLeaf(state, { direction, newPageId: pageId });
  expect(result.ok, result.ok ? "" : result.error).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result;
}

test("向右分：新叶在右，焦点到新格", () => {
  const start = createSingleLeafState("page-a");
  const result = mustSplit(start, "right", "page-b");
  expect(result.didFallbackToDown).toBe(false);
  expect(walkLeaves(result.state.root).map((leaf) => leaf.pageId)).toEqual([
    "page-a",
    "page-b",
  ]);
  expect(result.state.focusedLeafId).toBe(result.newLeafId);
  expect(findLeaf(result.state.root, result.newLeafId)?.pageId).toBe("page-b");
  expect(result.state.root.kind).toBe("group");
  if (result.state.root.kind === "group") {
    expect(result.state.root.orientation).toBe("horizontal");
  }
});

test("向下分：新叶在下", () => {
  const start = createSingleLeafState("page-a");
  const result = mustSplit(start, "down", "page-b");
  expect(walkLeaves(result.state.root).map((leaf) => leaf.pageId)).toEqual([
    "page-a",
    "page-b",
  ]);
  if (result.state.root.kind === "group") {
    expect(result.state.root.orientation).toBe("vertical");
  }
});

test("窄编辑列向右分会改成向下分", () => {
  const start = createSingleLeafState("page-a");
  const result = splitLeaf(start, {
    direction: "right",
    newPageId: "page-b",
    editorWidthPx: 719,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.didFallbackToDown).toBe(true);
  if (result.state.root.kind === "group") {
    expect(result.state.root.orientation).toBe("vertical");
  }
});

test("2x2 时向右邻接按几何而不是创建顺序", () => {
  let state = createSingleLeafState("A");
  state = mustSplit(state, "right", "B").state;
  state = {
    ...state,
    focusedLeafId: leafByPage(state, "A").id,
  };
  state = mustSplit(state, "down", "C").state;
  state = {
    ...state,
    focusedLeafId: leafByPage(state, "B").id,
  };
  state = mustSplit(state, "down", "D").state;

  expect(walkLeaves(state.root).map((leaf) => leaf.pageId)).toEqual([
    "A",
    "C",
    "B",
    "D",
  ]);

  const a = leafByPage(state, "A");
  const b = leafByPage(state, "B");
  const c = leafByPage(state, "C");
  const d = leafByPage(state, "D");

  expect(neighborLeaf(state, a.id, "right")?.pageId).toBe("B");
  expect(neighborLeaf(state, a.id, "right")?.id).not.toBe(c.id);
  expect(neighborLeaf(state, c.id, "right")?.pageId).toBe("D");
  expect(neighborLeaf(state, a.id, "down")?.pageId).toBe("C");
  expect(neighborLeaf(state, b.id, "down")?.pageId).toBe("D");
  expect(neighborLeaf(state, b.id, "left")?.id).toBe(a.id);
  expect(neighborLeaf(state, d.id, "up")?.id).toBe(b.id);
});

test("关叶后兄弟吃空间，焦点落到邻格", () => {
  let state = createSingleLeafState("A");
  state = mustSplit(state, "right", "B").state;
  const closed = leafByPage(state, "B");
  const remaining = leafByPage(state, "A");
  const result = closeLeaf(state, closed.id);
  expect(result.kind).toBe("updated");
  if (result.kind !== "updated") return;
  expect(countLeaves(result.state.root)).toBe(1);
  expect(result.state.root.kind).toBe("leaf");
  expect(result.state.focusedLeafId).toBe(remaining.id);
  expect(walkLeaves(result.state.root)[0]?.pageId).toBe("A");
});

test("第 5 叶拒绝", () => {
  let state = createSingleLeafState("A");
  state = mustSplit(state, "right", "B").state;
  state = mustSplit(state, "right", "C").state;
  state = mustSplit(state, "down", "D").state;
  expect(countLeaves(state.root)).toBe(4);
  const rejected = splitLeaf(state, { direction: "right", newPageId: "E" });
  expect(rejected.ok).toBe(false);
  if (rejected.ok) return;
  expect(rejected.error).toContain("4");
  expect(countLeaves(rejected.state.root)).toBe(4);
  expect(walkLeaves(rejected.state.root).map((leaf) => leaf.pageId)).toEqual(
    walkLeaves(state.root).map((leaf) => leaf.pageId),
  );
});

test("最后一叶 close 返回 last-pane 且不改树", () => {
  const state = createSingleLeafState("only");
  const result = closeLeaf(state);
  expect(result.kind).toBe("last-pane");
  expect(result.state).toBe(state);
  expect(result.state.root.kind).toBe("leaf");
});

test("zoom 不影响树结构", () => {
  let state = createSingleLeafState("A");
  state = mustSplit(state, "right", "B").state;
  const before = JSON.stringify(state.root);
  const zoomed = toggleZoom(state);
  expect(zoomed.zoomedLeafId).toBe(state.focusedLeafId);
  expect(JSON.stringify(zoomed.root)).toBe(before);
  expect(walkLeaves(zoomed.root).map((leaf) => leaf.pageId)).toEqual(
    walkLeaves(state.root).map((leaf) => leaf.pageId),
  );
  const unzoomed = toggleZoom(zoomed);
  expect(unzoomed.zoomedLeafId).toBeNull();
  expect(JSON.stringify(unzoomed.root)).toBe(before);
});
