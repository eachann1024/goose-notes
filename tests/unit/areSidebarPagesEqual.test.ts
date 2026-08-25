import { expect, test } from "playwright/test";
import type { Page } from "../../src/types";
import { areSidebarPagesEqual } from "../../src/stores/pages/areSidebarPagesEqual";

function page(overrides: Partial<Page> & { id: string; title?: string }): Page {
  const title = overrides.title ?? "Hello";
  const { title: _omit, ...rest } = overrides;
  return {
    workspaceId: "nb",
    content: [
      {
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: title }],
      },
    ],
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    createdAt: 1,
    updatedAt: 1,
    ...rest,
  };
}

test("正文内容变、标题不变时侧栏视为同一份树", () => {
  const before = {
    a: page({
      id: "a",
      content: [
        { type: "heading", props: { level: 1 }, content: [{ type: "text", text: "Hello" }] },
        { type: "paragraph", content: [{ type: "text", text: "old" }] },
      ],
      updatedAt: 10,
    }),
  };
  const after = {
    a: page({
      id: "a",
      content: [
        { type: "heading", props: { level: 1 }, content: [{ type: "text", text: "Hello" }] },
        { type: "paragraph", content: [{ type: "text", text: "new body" }] },
      ],
      updatedAt: 99,
    }),
  };
  expect(areSidebarPagesEqual(before, after)).toBe(true);
});

test("改标题或父子关系时侧栏要重绘", () => {
  const before = { a: page({ id: "a", title: "Hello" }) };
  const renamed = { a: page({ id: "a", title: "World" }) };
  const moved = { a: page({ id: "a", title: "Hello", parentId: "folder" }) };
  expect(areSidebarPagesEqual(before, renamed)).toBe(false);
  expect(areSidebarPagesEqual(before, moved)).toBe(false);
});
