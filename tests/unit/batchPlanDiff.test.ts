import { expect, test } from "playwright/test";
import {
  diffTextLines,
  planOperationKindLabel,
} from "../../src/pages/workspace/components/notebook-ai/batchPlanDiff";

test("相同文本全部记为未改动行", () => {
  expect(diffTextLines("a\nb", "a\nb")).toEqual([
    { kind: "eq", text: "a" },
    { kind: "eq", text: "b" },
  ]);
});

test("中间替换保留上下文行", () => {
  expect(diffTextLines("a\nold\nc", "a\nnew\nc")).toEqual([
    { kind: "eq", text: "a" },
    { kind: "del", text: "old" },
    { kind: "add", text: "new" },
    { kind: "eq", text: "c" },
  ]);
});

test("整段新增只出 add 行", () => {
  expect(diffTextLines("", "hello")).toEqual([{ kind: "add", text: "hello" }]);
});

test("操作类型文案", () => {
  expect(planOperationKindLabel("edit")).toBe("编辑");
  expect(planOperationKindLabel("create")).toBe("新建");
  expect(planOperationKindLabel("delete")).toBe("删除");
  expect(planOperationKindLabel("search_replace")).toBe("替换");
});
