import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import {
  releaseTableChrome,
  tableHandleRect,
} from "../../src/components/editor/menus/tableHandleGeometry";

const handleSource = readFileSync(
  "src/components/editor/menus/GooseTableHandle.tsx",
  "utf8",
);
const tableCss = readFileSync(
  "src/pages/workspace/styles/editor-base/tables-callouts.css",
  "utf8",
);

test("兄弟实例卸载不释放当前菜单，拥有者关闭才恢复控件", () => {
  expect(releaseTableChrome("row", "column")).toBe("row");
  expect(releaseTableChrome("row", "row")).toBeUndefined();
  expect(releaseTableChrome("addOrRemoveRows", "column")).toBe(
    "addOrRemoveRows",
  );
  expect(releaseTableChrome(undefined, "row")).toBeUndefined();
  expect(handleSource).not.toContain("document.documentElement.classList");
});

test("卸载只结束本实例拖拽；菜单拥有者仍解冻，兄弟实例不清理", () => {
  const source = handleSource.slice(
    handleSource.indexOf("export function GooseTableHandle("),
  );
  const cleanup = /useEffect\(\s*\(\) => \(\) => \{([^}]+)\}/.exec(source)![1];
  const runCleanup = new Function(
    "ownsInteraction",
    "ownsDrag",
    "tableHandles",
    "hideOtherElements",
    cleanup,
  );
  for (const [ownsInteraction, ownsDrag, expected] of [
    [false, false, []],
    [true, false, ["unfreeze", "show"]],
    [true, true, ["unfreeze", "dragEnd", "show"]],
  ] as const) {
    const calls: string[] = [];
    runCleanup(
      { current: ownsInteraction },
      { current: ownsDrag },
      {
        unfreezeHandles: () => calls.push("unfreeze"),
        dragEnd: () => calls.push("dragEnd"),
      },
      (hidden: boolean) => calls.push(hidden ? "hide" : "show"),
    );
    expect(calls).toEqual(expected);
  }
  expect(source).toContain("const ownsDrag = useRef(false)");
  const dragStart = source.slice(
    source.indexOf("const handleDragStart ="),
    source.indexOf("const handleDragEnd ="),
  );
  const dragEnd = source.slice(
    source.indexOf("const handleDragEnd ="),
    source.indexOf("const insertDimension ="),
  );
  expect(dragStart).toContain("ownsDrag.current = true");
  expect(dragEnd).toContain("ownsDrag.current = false");
  expect(source.match(/ownsDrag.current = true/g)).toHaveLength(1);
});

test("真实 table border box 保留负坐标/非等宽列，并反映更新与拖动", () => {
  const table = { x: -200, y: -80, width: 1000, height: 400 };
  const cell = { x: 300, y: 40, width: 230, height: 44 };
  expect(tableHandleRect(table, cell, "row")).toEqual({
    x: -200,
    y: 40,
    width: 1000,
    height: 44,
  });
  expect(tableHandleRect(table, cell, "column")).toEqual({
    x: 300,
    y: -80,
    width: 230,
    height: 400,
  });
  expect(
    tableHandleRect(
      { ...table, width: 1200, height: 500 },
      { ...cell, width: 300 },
      "column",
    ).height,
  ).toBe(500);
  expect(
    tableHandleRect(table, cell, "row", {
      draggedCellOrientation: "row",
      mousePos: 100,
    }).y,
  ).toBe(78);
  expect(
    tableHandleRect(table, cell, "column", {
      draggedCellOrientation: "col",
      mousePos: 500,
    }).x,
  ).toBe(385);
});

test("保留冻结/拖拽/危险色契约，追加条无圆形外环", () => {
  expect(handleSource).toContain("tableHandles?.freezeHandles()");
  expect(handleSource).toContain("tableHandles?.unfreezeHandles()");
  expect(handleSource).toContain("goose-editor-position-safe-trigger");
  expect(handleSource).toContain('className="goose-menu-item-danger"');
  expect(handleSource).toContain(
    "getTableDeletionLabel(deletionSnapshot.plan)",
  );
  const svg =
    /\.goose-table-extend-button > svg,\s*\.goose-table-handle-btn > svg \{([^}]+)\}/.exec(
      tableCss,
    )![1];
  expect(svg).toContain("box-shadow: none");
  expect(svg).toContain("border: 0");
});

test("删除文案与执行复用打开菜单时的快照，不在关闭回焦后重新读取 selection", () => {
  expect(handleSource).toContain(
    "setDeletionSnapshot(captureDeletionSnapshot())",
  );
  const capture = handleSource.slice(
    handleSource.indexOf("const captureDeletionSnapshot ="),
    handleSource.indexOf("const handleDelete ="),
  );
  expect(capture).toContain("selectedRect(editor.prosemirrorState)");
  expect(capture).toContain("return createTableDeletionSnapshot(");
  const deletion = handleSource.slice(
    handleSource.indexOf("const handleDelete ="),
    handleSource.indexOf("const toggleHeader ="),
  );
  expect(deletion).toContain("const snapshot = deletionSnapshot");
  expect(deletion).toContain("editor.getBlock(snapshot.blockId)");
  expect(deletion).not.toContain("editor.prosemirrorState.selection");
  expect(handleSource).toContain(
    "getTableDeletionLabel(deletionSnapshot.plan)",
  );
});

test("表格菜单复用自带右键菜单样式，仅保留手柄打开态与横向色块功能布局", () => {
  expect(tableCss).toMatch(
    /\.goose-table-handle-btn\[aria-expanded="true"\] \{[^}]*var\(--goose-block-subtle-hover\)[^}]*color: hsl\(var\(--foreground\)\)/,
  );
  expect(tableCss).not.toContain("width: 244px");
  expect(tableCss).not.toContain("--goose-interactive-hover:");
  expect(tableCss).not.toContain("--goose-interactive-selected:");
  expect(tableCss).not.toContain(".goose-menu-separator");
  expect(tableCss).not.toContain("min-height: 32px");
  expect(tableCss).not.toContain(
    '.goose-table-color-swatch[aria-checked="true"]',
  );
  expect(handleSource).toContain('className="goose-menu-item-danger"');
  const shared = readFileSync("src/components/ui/context-menu.tsx", "utf8");
  const heading =
    "px-2 py-1 text-xs font-semibold tracking-wide text-muted-foreground";
  expect(shared).toContain(heading);
  expect(handleSource).toContain(heading);
  expect(tableCss).toContain("grid-template-columns: repeat(5, 32px)");
  const swatch =
    /\.goose-table-menu \.goose-menu-item\.goose-table-color-swatch \{([^}]+)\}/.exec(
      tableCss,
    )![1];
  expect(swatch).toContain("width: 32px");
  expect(swatch).toContain("height: 32px");
  expect(swatch).toContain("padding: 4px");
  expect(swatch).not.toMatch(/background|color|radius|outline/);
  expect(tableCss).toContain(".goose-table-color-swatch > span");
});

test("色块使用原生单选 collection 和真实文档状态，标题状态有朗读文本", () => {
  expect(handleSource).toContain(
    'import { Dropdown, Header } from "@heroui/react"',
  );
  expect(handleSource).toContain('className="goose-table-color-group"');
  expect(handleSource).toContain('selectionMode="single"');
  expect(handleSource).toContain(
    "selectedColor ? [`${property}:${selectedColor}`] : []",
  );
  expect(handleSource).toContain("id={`${property}:${color}`}");
  expect(handleSource).toContain(
    'aria-label={`${label}${property === "textColor" ? "文字" : "背景"}`}',
  );
  expect(handleSource).toContain("const selectedColor = tableDimensionColor(");
  expect(handleSource).not.toContain('role="menuitemradio"');
  const headers = handleSource.slice(
    handleSource.indexOf('{(["headerRows", "headerCols"]'),
  );
  expect(headers).toContain(
    'textValue={`${key === "headerRows" ? "标题行" : "标题列"}，${state.block.content[key] ? "已启用" : "未启用"}`}',
  );
  expect(headers).toMatch(
    /<span className="sr-only">\s*\{state.block.content\[key\] \? "已启用" : "未启用"\}/,
  );
  expect(headers).not.toContain('aria-label="已启用"');
});

test("方案 A 局部小圆角为 4px，手柄与加号通过布局尺寸缩放而非 transform", () => {
  expect(tableCss).toMatch(
    /\.goose-table-extend-button,\s*\.goose-table-handle-btn \{\s*--radius-sm: 4px;/,
  );
  const handle =
    /\.goose-table-handle-btn\.goose-editor-position-safe-trigger \{([^}]+)\}/.exec(
      tableCss,
    )![1];
  expect(handle).toContain("zoom: 1");
  expect(handle).toContain("transform: none");
  expect(handle).toContain("width: var(--editor-control-height-sm)");
  expect(handle).toContain("height: var(--editor-control-height-sm)");
  expect(handle).toContain(
    "border-radius: calc(var(--radius-sm) * var(--editor-scale, 1))",
  );
  const svg =
    /\.goose-table-extend-button > svg,\s*\.goose-table-handle-btn > svg \{([^}]+)\}/.exec(
      tableCss,
    )![1];
  expect(svg).toContain("inline-size: var(--editor-control-icon-lg-size)");
  expect(svg).toContain("block-size: var(--editor-control-icon-lg-size)");
  const tokens = readFileSync("src/index.css", "utf8");
  expect(tokens).toContain(
    "--editor-control-height-sm: calc(24px * var(--editor-scale))",
  );
  expect(tokens).toContain(
    "--editor-control-icon-lg-size: calc(16px * var(--editor-scale))",
  );
  const controller = readFileSync(
    "src/components/editor/menus/GooseTableHandlesController.tsx",
    "utf8",
  );
  expect(controller).toContain("offset(gap)");
  expect(controller).toMatch(/placement="left"\s*gap=\{4\}/);
  expect(controller).toMatch(/placement="top"\s*gap=\{4\}/);
});
