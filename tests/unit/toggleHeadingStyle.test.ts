import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import { shouldAutoCollectToggleHeading } from "../../src/components/editor/extensions/toggleHeadingAutoCollectExtension";
import { ensureBlockMoveDragging } from "../../src/components/editor/core/ensureBlockMoveDragging";

test("折叠块不再画左侧引用线", () => {
  const togglesCss = readFileSync(
    new URL("../../src/pages/workspace/styles/editor-base/toggles.css", import.meta.url),
    "utf8",
  );
  expect(togglesCss).not.toContain("left: -14px");
  expect(togglesCss).not.toMatch(
    /\.bn-block-group::before[\s\S]*width:\s*1px/,
  );
});

test("折叠标题 children 顶格，不再画收起摘要", () => {
  const togglesCss = readFileSync(
    new URL("../../src/pages/workspace/styles/editor-base/toggles.css", import.meta.url),
    "utf8",
  );
  expect(togglesCss).not.toContain("goose-toggle-preview");
  expect(togglesCss).toContain(
    '[data-content-type="heading"][data-is-toggleable="true"]',
  );
  expect(togglesCss).toContain("margin-left: 0");
});

test("已有 children 的折叠标题不自动收编后续兄弟", () => {
  expect(
    shouldAutoCollectToggleHeading({
      id: "a",
      type: "heading",
      props: { isToggleable: true },
      children: [],
    }),
  ).toBe(true);
  expect(
    shouldAutoCollectToggleHeading({
      id: "b",
      type: "heading",
      props: { isToggleable: true },
      children: [{ id: "c", type: "paragraph", props: {}, children: [] }],
    }),
  ).toBe(false);
  expect(
    shouldAutoCollectToggleHeading({
      id: "d",
      type: "paragraph",
      props: {},
      children: [],
    }),
  ).toBe(false);
});

test("侧栏把手不截获块拖放，已有 dragging 时不覆盖", () => {
  const source = readFileSync(
    new URL("../../src/components/editor/core/EditorSideMenu.tsx", import.meta.url),
    "utf8",
  );
  expect(source).toContain("ensureBlockMoveDragging");
  expect(source).not.toMatch(/onDrop=\{/);
  const existing = { slice: {} as never, move: false };
  const view = {
    dragging: existing,
    state: { schema: { nodes: {} } },
  } as never;
  const dt = {
    getData: () => "<div data-id='x'></div>",
  } as unknown as DataTransfer;
  ensureBlockMoveDragging(view, dt);
  expect(view.dragging).toBe(existing);
});
