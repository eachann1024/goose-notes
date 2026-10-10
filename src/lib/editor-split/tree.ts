import {
  MAX_SPLIT_LEAVES,
  type CloseLeafResult,
  type SplitDirection,
  type SplitGroup,
  type SplitLeaf,
  type SplitLeafResult,
  type SplitNode,
  type SplitState,
} from "./types";

export { MAX_SPLIT_LEAVES } from "./types";

import {
  createSplitNodeId,
  orientationForDirection,
  normalizeSizes,
  walkLeaves,
  findLeaf,
  findGroup,
  countLeaves,
  replaceNode,
  findLeafPath,
} from "./treePrimitives";
export {
  normalizeSizes,
  walkLeaves,
  findLeaf,
  findGroup,
  countLeaves,
  createSingleLeafState,
} from "./treePrimitives";
export { neighborLeaf } from "./treeGeometry";

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
    const remaining = walkLeaves(state.root).filter(
      (leaf) => leaf.id !== closedId,
    );
    return remaining[0]?.id ?? closedId;
  }
  const neighbor =
    path.index > 0
      ? path.parent.children[path.index - 1]
      : path.parent.children[path.index + 1];
  if (!neighbor) {
    const remaining = walkLeaves(state.root).filter(
      (leaf) => leaf.id !== closedId,
    );
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
    state.zoomedLeafId &&
    nextLeaves.some((leaf) => leaf.id === state.zoomedLeafId)
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
