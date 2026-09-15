import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("ContextMenu 用捕获阶段 pointerdown 关闭，不把整块 trigger 当成内部", () => {
  const source = readFileSync("src/components/ui/context-menu.tsx", "utf8");
  expect(source).toContain("outsidePress: false");
  expect(source).toContain(
    'document.addEventListener("pointerdown", closeOnOutside, true)',
  );
  expect(source).toContain("isInsideMenuFloating");
});

test("块左侧 + / grip 不弹出编辑器右键菜单，无整行选区时拷贝仍可用", () => {
  const menu = readFileSync(
    "src/components/editor/menus/EditorContextMenu.tsx",
    "utf8",
  );
  expect(menu).toContain('target.closest(".bn-side-menu")');
  expect(menu).toContain("resolveCopyBlockSelection");
  expect(menu).toContain("disabled={!canCopy}");
  expect(menu).not.toContain("disabled={!selectedText}\n            onSelect={handleCopySelection}");
});
