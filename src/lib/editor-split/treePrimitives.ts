import type {
  SplitDirection,
  SplitGroup,
  SplitGroupOrientation,
  SplitLeaf,
  SplitNode,
  SplitState,
} from "./types";

export function createSplitNodeId(prefix: "leaf" | "group"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function orientationForDirection(
  direction: SplitDirection,
): SplitGroupOrientation {
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

export function replaceNode(
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

export function findLeafPath(
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
