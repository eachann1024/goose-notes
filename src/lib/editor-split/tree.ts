import {
  MAX_SPLIT_LEAVES,
  type CloseLeafResult,
  type SplitDirection,
  type SplitGroup,
  type SplitGroupOrientation,
  type SplitLeaf,
  type SplitLeafResult,
  type SplitNeighborDirection,
  type SplitNode,
  type SplitState,
} from "./types";

export { MAX_SPLIT_LEAVES } from "./types";

const SIZE_EPS = 1e-4;

type LeafRect = { x: number; y: number; w: number; h: number };

type LaidOutLeaf = {
  leaf: SplitLeaf;
  rect: LeafRect;
};

function createSplitNodeId(prefix: "leaf" | "group"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function orientationForDirection(direction: SplitDirection): SplitGroupOrientation {
  return direction === "right" ? "horizontal" : "vertical";
}

/**
 * 把一组百分比归一成 `count` 项且合计 100。长度不对或全 0 时均分。
 */
export function normalizeSizes(sizes: number[], count: number): number[] {
  if (count <= 0) return [];
  const usable = sizes
    .slice(0, count)
    .map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  while (usable.length < count) usable.push(0);
  const sum = usable.reduce((acc, value) => acc + value, 0);
  const source = sum <= 0 ? Array.from({ length: count }, () => 1) : usable;
  const sourceSum = source.reduce((acc, value) => acc + value, 0);
  const scaled = source.map((value) => (value / sourceSum) * 100);
  const rounded = scaled.map((value) => Math.round(value * 10000) / 10000);
  const drift = 100 - rounded.reduce((acc, value) => acc + value, 0);
  rounded[rounded.length - 1] += drift;
  return rounded;
}

/**
 * 深度优先、与视觉顺序一致地列出全部叶子。
 */
export function walkLeaves(node: SplitNode): SplitLeaf[] {
  if (node.kind === "leaf") return [node];
  return node.children.flatMap(walkLeaves);
}

/**
 * 在树里找指定叶子。找不到返回 `null`。
 */
export function findLeaf(node: SplitNode, leafId: string): SplitLeaf | null {
  if (node.kind === "leaf") return node.id === leafId ? node : null;
  for (const child of node.children) {
    const found = findLeaf(child, leafId);
    if (found) return found;
  }
  return null;
}

/**
 * 在树里找指定 group。找不到返回 `null`。
 */
export function findGroup(node: SplitNode, groupId: string): SplitGroup | null {
  if (node.kind === "leaf") return null;
  if (node.id === groupId) return node;
  for (const child of node.children) {
    const found = findGroup(child, groupId);
    if (found) return found;
  }
  return null;
}

export function countLeaves(node: SplitNode): number {
  return walkLeaves(node).length;
}

/**
 * 单叶状态：一个 Tab 尚未分屏时的根。
 */
export function createSingleLeafState(
  pageId: string,
  leafId: string = createSplitNodeId("leaf"),
): SplitState {
  return {
    root: { kind: "leaf", id: leafId, pageId },
    focusedLeafId: leafId,
    zoomedLeafId: null,
  };
}

function replaceNode(
  root: SplitNode,
  targetId: string,
  next: SplitNode,
): SplitNode {
  if (root.id === targetId) return next;
  if (root.kind === "leaf") return root;
  return {
    ...root,
    children: root.children.map((child) => replaceNode(child, targetId, next)),
  };
}

type LeafPath = {
  leaf: SplitLeaf;
  parent: SplitGroup | null;
  index: number;
};

function findLeafPath(
  node: SplitNode,
  leafId: string,
  parent: SplitGroup | null = null,
  index = 0,
): LeafPath | null {
  if (node.kind === "leaf") {
    return node.id === leafId ? { leaf: node, parent, index } : null;
  }
  for (let i = 0; i < node.children.length; i += 1) {
    const found = findLeafPath(node.children[i], leafId, node, i);
    if (found) return found;
  }
  return null;
}

function layoutLeaves(node: SplitNode, rect: LeafRect): LaidOutLeaf[] {
  if (node.kind === "leaf") return [{ leaf: node, rect }];
  const sizes = normalizeSizes(node.sizes, node.children.length);
  const out: LaidOutLeaf[] = [];
  let offset = 0;
  for (let i = 0; i < node.children.length; i += 1) {
    const frac = (sizes[i] ?? 0) / 100;
    const childRect: LeafRect =
      node.orientation === "horizontal"
        ? { x: rect.x + offset * rect.w, y: rect.y, w: rect.w * frac, h: rect.h }
        : { x: rect.x, y: rect.y + offset * rect.h, w: rect.w, h: rect.h * frac };
    out.push(...layoutLeaves(node.children[i], childRect));
    offset += frac;
  }
  return out;
}

function rangeOverlap(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

/**
 * 按几何邻接找相邻叶子，不按创建顺序。
 *
 * 判定：共享那条边（左右看 x，上下看 y），且沿另一轴有正长度重叠。
 * 多候选时取重叠更大者；再平手则取更靠上 / 更靠左的一格。
 */
export function neighborLeaf(
  state: SplitState,
  leafId: string,
  dir: SplitNeighborDirection,
): SplitLeaf | null {
  const laidOut = layoutLeaves(state.root, { x: 0, y: 0, w: 1, h: 1 });
  const current = laidOut.find((item) => item.leaf.id === leafId);
  if (!current) return null;
  const { rect: r } = current;

  const candidates = laidOut.filter(({ leaf, rect }) => {
    if (leaf.id === leafId) return false;
    switch (dir) {
      case "right":
        return (
          Math.abs(rect.x - (r.x + r.w)) < SIZE_EPS &&
          rangeOverlap(r.y, r.y + r.h, rect.y, rect.y + rect.h) > SIZE_EPS
        );
      case "left":
        return (
          Math.abs(rect.x + rect.w - r.x) < SIZE_EPS &&
          rangeOverlap(r.y, r.y + r.h, rect.y, rect.y + rect.h) > SIZE_EPS
        );
      case "down":
        return (
          Math.abs(rect.y - (r.y + r.h)) < SIZE_EPS &&
          rangeOverlap(r.x, r.x + r.w, rect.x, rect.x + rect.w) > SIZE_EPS
        );
      case "up":
        return (
          Math.abs(rect.y + rect.h - r.y) < SIZE_EPS &&
          rangeOverlap(r.x, r.x + r.w, rect.x, rect.x + rect.w) > SIZE_EPS
        );
    }
  });
  if (candidates.length === 0) return null;

  const axisOverlap = (item: LaidOutLeaf) =>
    dir === "left" || dir === "right"
      ? rangeOverlap(r.y, r.y + r.h, item.rect.y, item.rect.y + item.rect.h)
      : rangeOverlap(r.x, r.x + r.w, item.rect.x, item.rect.x + item.rect.w);

  candidates.sort((a, b) => {
    const overlapDelta = axisOverlap(b) - axisOverlap(a);
    if (Math.abs(overlapDelta) > SIZE_EPS) return overlapDelta;
    if (dir === "left" || dir === "right") return a.rect.y - b.rect.y;
    return a.rect.x - b.rect.x;
  });
  return candidates[0]?.leaf ?? null;
}

export type SplitLeafInput = {
  direction: SplitDirection;
  newPageId: string;
  /** 默认当前焦点叶。 */
  leafId?: string;
  newLeafId?: string;
  newGroupId?: string;
};

/**
 * 在指定叶处分屏。新叶落在右侧（horizontal）或下方（vertical）。
 * 原叶 pageId 不变。已有 4 叶时返回错误，不改树。分屏会清掉 zoom。
 */
export function splitLeaf(
  state: SplitState,
  input: SplitLeafInput,
): SplitLeafResult {
  const leafId = input.leafId ?? state.focusedLeafId;
  const path = findLeafPath(state.root, leafId);
  if (!path) {
    return { ok: false, error: "找不到当前分屏格子", state };
  }
  if (countLeaves(state.root) >= MAX_SPLIT_LEAVES) {
    return { ok: false, error: "最多只能分成 4 格", state };
  }

  const orientation = orientationForDirection(input.direction);
  const newLeaf: SplitLeaf = {
    kind: "leaf",
    id: input.newLeafId ?? createSplitNodeId("leaf"),
    pageId: input.newPageId,
  };

  const parent = path.parent;
  let nextRoot: SplitNode;
  if (parent && parent.orientation === orientation) {
    const sizes = [...parent.sizes];
    const currentSize = sizes[path.index] ?? 0;
    const half = currentSize / 2;
    sizes[path.index] = half;
    sizes.splice(path.index + 1, 0, half);
    const children = [...parent.children];
    children.splice(path.index + 1, 0, newLeaf);
    nextRoot = replaceNode(state.root, parent.id, {
      ...parent,
      children,
      sizes: normalizeSizes(sizes, children.length),
    });
  } else {
    const group: SplitGroup = {
      kind: "group",
      id: input.newGroupId ?? createSplitNodeId("group"),
      orientation,
      children: [path.leaf, newLeaf],
      sizes: [50, 50],
    };
    nextRoot = replaceNode(state.root, path.leaf.id, group);
  }

  return {
    ok: true,
    newLeafId: newLeaf.id,
    state: {
      root: nextRoot,
      focusedLeafId: newLeaf.id,
      zoomedLeafId: null,
    },
  };
}

function removeLeafNode(node: SplitNode, leafId: string): SplitNode {
  if (node.kind === "leaf") return node;

  const direct = node.children.findIndex(
    (child) => child.kind === "leaf" && child.id === leafId,
  );
  let children: SplitNode[];
  let sizes: number[];
  if (direct >= 0) {
    sizes = [...node.sizes];
    const eaten = sizes[direct] ?? 0;
    sizes.splice(direct, 1);
    const giveTo = direct > 0 ? direct - 1 : 0;
    if (sizes.length > 0) {
      sizes[giveTo] = (sizes[giveTo] ?? 0) + eaten;
    }
    children = node.children.filter((_, index) => index !== direct);
  } else {
    children = node.children.map((child) => removeLeafNode(child, leafId));
    sizes = node.sizes;
  }

  if (children.length === 1) return children[0];
  return {
    ...node,
    children,
    sizes: normalizeSizes(sizes, children.length),
  };
}

function focusAfterClose(state: SplitState, closedId: string): string {
  const path = findLeafPath(state.root, closedId);
  if (!path?.parent) {
    const remaining = walkLeaves(state.root).filter((leaf) => leaf.id !== closedId);
    return remaining[0]?.id ?? closedId;
  }
  const neighbor =
    path.index > 0
      ? path.parent.children[path.index - 1]
      : path.parent.children[path.index + 1];
  if (!neighbor) {
    const remaining = walkLeaves(state.root).filter((leaf) => leaf.id !== closedId);
    return remaining[0]?.id ?? closedId;
  }
  const neighborLeaves = walkLeaves(neighbor);
  if (neighborLeaves.length === 0) return state.focusedLeafId;
  return path.index > 0
    ? neighborLeaves[neighborLeaves.length - 1].id
    : neighborLeaves[0].id;
}

/**
 * 关掉一叶：兄弟吃掉它的空间；只剩一叶的 group 会被提升。
 * 树里只剩这一叶时返回 `{ kind: "last-pane" }`，不改树，由调用方关 Tab。
 */
export function closeLeaf(
  state: SplitState,
  leafId: string = state.focusedLeafId,
): CloseLeafResult {
  const leaves = walkLeaves(state.root);
  if (leaves.length <= 1) {
    return { kind: "last-pane", state };
  }
  if (!leaves.some((leaf) => leaf.id === leafId)) {
    return { kind: "updated", state };
  }

  const nextFocused =
    state.focusedLeafId === leafId
      ? focusAfterClose(state, leafId)
      : state.focusedLeafId;
  const nextRoot = removeLeafNode(state.root, leafId);
  const nextLeaves = walkLeaves(nextRoot);
  const focusedLeafId = nextLeaves.some((leaf) => leaf.id === nextFocused)
    ? nextFocused
    : (nextLeaves[0]?.id ?? state.focusedLeafId);
  const zoomedLeafId =
    state.zoomedLeafId && nextLeaves.some((leaf) => leaf.id === state.zoomedLeafId)
      ? state.zoomedLeafId
      : null;

  return {
    kind: "updated",
    state: {
      root: nextRoot,
      focusedLeafId,
      zoomedLeafId,
    },
  };
}

/**
 * 写入某个 group 的百分比尺寸。长度会按 children 归一。
 */
export function replaceSizes(
  state: SplitState,
  groupId: string,
  sizes: number[],
): SplitState {
  const group = findGroup(state.root, groupId);
  if (!group) return state;
  return {
    ...state,
    root: replaceNode(state.root, groupId, {
      ...group,
      sizes: normalizeSizes(sizes, group.children.length),
    }),
  };
}

/**
 * 当前叶占满 / 退出占满。只改 `zoomedLeafId`，树结构不变。
 */
export function toggleZoom(
  state: SplitState,
  leafId: string = state.focusedLeafId,
): SplitState {
  if (state.zoomedLeafId) {
    return { ...state, zoomedLeafId: null };
  }
  if (!findLeaf(state.root, leafId)) return state;
  return { ...state, zoomedLeafId: leafId };
}

/**
 * 把焦点移到指定叶。若正处于 zoom，zoom 跟着移到新叶。
 */
export function focusLeaf(state: SplitState, paneId: string): SplitState {
  if (!findLeaf(state.root, paneId)) return state;
  return {
    ...state,
    focusedLeafId: paneId,
    zoomedLeafId: state.zoomedLeafId ? paneId : null,
  };
}

/**
 * 改某叶绑定的页面。树结构不变。
 */
export function setLeafPage(
  state: SplitState,
  paneId: string,
  pageId: string,
): SplitState {
  const leaf = findLeaf(state.root, paneId);
  if (!leaf || leaf.pageId === pageId) return state;
  return {
    ...state,
    root: replaceNode(state.root, paneId, { ...leaf, pageId }),
  };
}

export function focusedPageIdOf(state: SplitState): string | null {
  return findLeaf(state.root, state.focusedLeafId)?.pageId ?? null;
}

export function isSplitState(state: SplitState): boolean {
  return countLeaves(state.root) > 1;
}
