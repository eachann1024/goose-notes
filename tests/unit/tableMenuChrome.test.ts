import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

const handleSource = readFileSync(
  "src/components/editor/menus/GooseTableHandle.tsx",
  "utf8",
);
const tableCss = readFileSync(
  "src/pages/workspace/styles/editor-base/tables-callouts.css",
  "utf8",
);
const baseCss = readFileSync("src/index.css", "utf8");

test("行/列菜单打开与关闭都会切换根节点 chrome class", () => {
  expect(handleSource).toContain(
    'const CHROME_HIDDEN_CLASS = "goose-table-chrome-hidden"',
  );
  expect(handleSource).toContain("setTableChromeHidden(open)");
  // closeMenu 与卸载兜底都要复位，避免加号永久隐身。
  expect(handleSource).toContain("setTableChromeHidden(false)");
  expect(handleSource).toMatch(
    /useEffect\(\(\) => \(\) => setTableChromeHidden\(false\)/,
  );
});

test("冻结手柄与隐藏其它元素的原有契约保留", () => {
  expect(handleSource).toContain("tableHandles?.freezeHandles()");
  expect(handleSource).toContain("tableHandles?.unfreezeHandles()");
  expect(handleSource).toContain("hideOtherElements(true)");
  expect(handleSource).toContain("hideOtherElements(false)");
  expect(handleSource).toContain("goose-editor-position-safe-trigger");
});

test("菜单打开时 CSS 藏掉 portal 里的加号按钮", () => {
  expect(tableCss).toMatch(
    /html\.goose-table-chrome-hidden \.goose-table-extend-button \{[^}]*visibility: hidden[^}]*pointer-events: none/,
  );
});

test("删除行和删除列都用危险色菜单项样式", () => {
  expect(handleSource).toMatch(
    /className="goose-menu-item-danger"[\s\S]{0,120}?删除行/,
  );
  expect(handleSource).toMatch(
    /className="goose-menu-item-danger"[\s\S]{0,120}?删除列/,
  );

  const dangerRule = /\.goose-menu-item-danger \{([^}]*)\}/.exec(baseCss)?.[1];
  expect(dangerRule).toContain("var(--goose-interactive-danger)");
  expect(dangerRule).not.toMatch(/#[0-9a-f]{3,8}/i);

  const dangerHover = baseCss
    .slice(baseCss.indexOf(".goose-menu-item-danger:hover"))
    .slice(0, 400);
  expect(dangerHover).toContain("var(--goose-interactive-danger)");
  expect(dangerHover).toContain("var(--goose-interactive-danger-border)");
  expect(dangerHover).not.toMatch(/#[0-9a-f]{3,8}/i);
});
