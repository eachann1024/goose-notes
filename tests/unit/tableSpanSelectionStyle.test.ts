import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

const tablesCss = readFileSync(
  new URL(
    "../../src/pages/workspace/styles/editor-base/tables-callouts.css",
    import.meta.url,
  ),
  "utf8",
);

const cssWithoutComments = tablesCss.replace(/\/\*[\s\S]*?\*\//g, "");
const cssRules = Array.from(
  cssWithoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g),
);
const selectionColorRule = cssRules.find(([, , declarations]) =>
  declarations.includes("--goose-editor-selection-bg"),
);
const selectedCellOverlayRule = cssRules.find(
  ([, selectors]) =>
    selectors.replace(/\s+/g, " ").trim() ===
    ":root .workspace-editor-surface .bn-editor .selectedCell::after",
);

test("跨表格文档选区保留强调色 token", () => {
  expect(selectionColorRule).toBeDefined();

  const selectors = selectionColorRule?.[1]
    .split(",")
    .map((selector) => selector.replace(/\s+/g, " ").trim());
  const declarations = selectionColorRule?.[2].replace(/\s+/g, " ");

  expect(selectors).toEqual([
    ':root .workspace-editor-surface .bn-editor.goose-table-span-select [data-content-type="table"] th',
    ':root .workspace-editor-surface .bn-editor.goose-table-span-select [data-content-type="table"] td',
  ]);
  expect(declarations).toContain(
    "background-color: var( --goose-editor-selection-bg, var(--goose-interactive-selected) )",
  );
  expect(declarations).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(/i);
});

test("CellSelection 清空文字上方的默认伪元素遮罩", () => {
  expect(selectedCellOverlayRule).toBeDefined();

  const declarations = selectedCellOverlayRule?.[2].replace(/\s+/g, " ");
  expect(declarations).toContain("background: transparent");
  expect(declarations).toContain("background-color: transparent");
  expect(declarations).not.toContain("--goose-editor-selection-bg");
  expect(declarations).toContain(
    "border: 0 solid var(--goose-table-selection)",
  );
  expect(declarations).toContain("inset: -1px");
  for (const edge of ["top", "right", "bottom", "left"]) {
    const rule = cssRules.find(([, selectors]) =>
      selectors.includes(`.selectedCell.goose-table-selection-${edge}::after`),
    );
    expect(rule?.[2]).toContain(`border-${edge}-width: 2px`);
  }
  expect(declarations).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(/i);
});

test("格选区轻底是非持久化背景图层，不遮文字或修改保存的单元格底色", () => {
  const fill = cssRules.find(
    ([, selectors]) =>
      selectors.replace(/\s+/g, " ").trim() ===
      ":root .workspace-editor-surface .bn-editor .selectedCell",
  )!;
  expect(fill[2]).toContain("--goose-editor-selection-bg");
  expect(fill[2]).toContain("var(--goose-interactive-selected)");
  expect(fill[2]).toContain("background-image: linear-gradient(");
  expect(fill[2]).not.toContain("background-color:");
  expect(fill[2]).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(/i);
});

test("表格选中色规则不会作用到未选中的普通表格", () => {
  expect(selectionColorRule).toBeDefined();

  const selectors = selectionColorRule?.[1].split(",") ?? [];
  expect(selectors).toHaveLength(2);
  for (const selector of selectors) {
    expect(selector).toMatch(/goose-table-span-select|\.selectedCell\s*$/);
  }
});
