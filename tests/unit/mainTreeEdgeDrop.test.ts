import { expect, test } from "playwright/test";
import {
  MAIN_TREE_EDGE_BAND,
  mainTreeEdgeDropTarget,
  resolveMainTreeEdgeZone,
} from "../../src/pages/workspace/components/sidebar/main-tree/mainTreeEdgeDrop";

/** 可视列表：垂直 200~700，横向 0~260，最后一行底边 420（内容比视口短） */
const viewportRect = { top: 200, bottom: 700, left: 0, right: 260 };
const edge = (pointerY: number, pointerX = 120, lastRowBottom = 420) =>
  resolveMainTreeEdgeZone({ pointerX, pointerY, viewportRect, lastRowBottom });

test("拖到可视列表上缘或越出上边界 → 上缘落点", () => {
  expect(edge(viewportRect.top)).toBe("top");
  expect(edge(viewportRect.top + MAIN_TREE_EDGE_BAND)).toBe("top");
  expect(edge(viewportRect.top - 300)).toBe("top");
});

test("拖到可视列表下缘、越出下边界或末行下方空白 → 下缘落点", () => {
  expect(edge(viewportRect.bottom)).toBe("bottom");
  expect(edge(viewportRect.bottom - MAIN_TREE_EDGE_BAND)).toBe("bottom");
  expect(edge(viewportRect.bottom + 300)).toBe("bottom");
  // 内容比视口短：最后一行下方那段空白同样按“下缘”处理
  expect(edge(421, 120, 420)).toBe("bottom");
  expect(edge(500, 120, 480)).toBe("bottom");
});

test("吸附带之外的列表中部仍走行内语义（排序 / 拖入文件夹）", () => {
  // 列表比视口长（最后一行在视口外）时，带外一律交给 rct 行内判定
  const tall = Number.POSITIVE_INFINITY;
  expect(edge(400, 120, tall)).toBeNull();
  expect(edge(viewportRect.top + MAIN_TREE_EDGE_BAND + 1, 120, tall)).toBeNull();
  expect(edge(viewportRect.bottom - MAIN_TREE_EDGE_BAND - 1, 120, tall)).toBeNull();
  // 落在最后一行行内（未越过其底边）仍是行内语义，不是置底
  expect(edge(419, 120, 420)).toBeNull();
});

test("横向移出列表（如拖到编辑区）不触发上下缘落点", () => {
  expect(edge(viewportRect.top - 20, viewportRect.right + 1)).toBeNull();
  expect(edge(viewportRect.bottom + 20, viewportRect.left - 1)).toBeNull();
});

test("边缘落点固定在根级：末位是根级最后一项之后，不是展开文件夹的最后子项", () => {
  // 根级 3 项、最后一项是展开文件夹（含 2 子项，可见行共 5 行）时，
  // 置底下标仍是根级第 3 个下标，而不是子项下标
  expect(mainTreeEdgeDropTarget("bottom", 3)).toMatchObject({
    targetType: "between-items",
    parentItem: "root",
    childIndex: 3,
  });
  expect(mainTreeEdgeDropTarget("top", 3)).toMatchObject({
    targetType: "between-items",
    parentItem: "root",
    childIndex: 0,
  });
  expect(mainTreeEdgeDropTarget("bottom", 0).childIndex).toBe(0);
});
