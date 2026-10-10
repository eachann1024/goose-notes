import type {
  SplitLeaf,
  SplitNeighborDirection,
  SplitNode,
  SplitState,
} from "./types";
import { normalizeSizes } from "./treePrimitives";

const SIZE_EPS = 1e-4;

type LeafRect = { x: number; y: number; w: number; h: number };

type LaidOutLeaf = {
  leaf: SplitLeaf;
  rect: LeafRect;
};

function layoutLeaves(node: SplitNode, rect: LeafRect): LaidOutLeaf[] {
  if (node.kind === "leaf") return [{ leaf: node, rect }];
  const sizes = normalizeSizes(node.sizes, node.children.length);
  const out: LaidOutLeaf[] = [];
  let offset = 0;
  for (let i = 0; i < node.children.length; i += 1) {
    const frac = (sizes[i] ?? 0) / 100;
    const childRect: LeafRect =
      node.orientation === "horizontal"
        ? {
            x: rect.x + offset * rect.w,
            y: rect.y,
            w: rect.w * frac,
            h: rect.h,
          }
        : {
            x: rect.x,
            y: rect.y + offset * rect.h,
            w: rect.w,
            h: rect.h * frac,
          };
    out.push(...layoutLeaves(node.children[i], childRect));
    offset += frac;
  }
  return out;
}

function rangeOverlap(a0: number, a1: number, b0: number, b1: number): number {
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
