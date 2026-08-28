import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

const MENU_SOURCES = [
  "src/components/ui/dropdown-menu.tsx",
  "src/components/editor/ui/dropdown-menu.tsx",
  "src/components/ui/context-menu.tsx",
] as const;

const SUGGESTION_SOURCES = [
  "src/components/editor/ai/composer/ComposerSuggestionsList.tsx",
  "src/components/editor/ai/composer/SkillSuggestionsList.tsx",
] as const;

const CLOSE_BUTTON_SOURCES = [
  "src/components/ui/dialog.tsx",
  "src/components/ui/sheet.tsx",
] as const;

const HOVER_SELECTED_FG = "hover:text-[var(--goose-interactive-selected-fg)]";
const HOVER_NESTED_SELECTED_FG =
  "hover:[&_*]:text-[var(--goose-interactive-selected-fg)]";

test("下拉与右键 highlighted 用强调色前景，不用 text-foreground", () => {
  for (const path of MENU_SOURCES) {
    const source = readFileSync(path, "utf8");
    expect(source, path).toContain(
      "data-[highlighted]:text-[var(--goose-interactive-selected-fg)]",
    );
    expect(source, path).not.toContain("data-[highlighted]:text-foreground");
  }
});

test("思考折叠 hover 用强调色背景，不用 --bui-hover-2", () => {
  const css = readFileSync(
    "src/pages/workspace/styles/beautiful-ui.css",
    "utf8",
  );
  const hoverRule = css.match(/\.bui-think-toggle:hover\s*\{[^}]*\}/)?.[0];
  expect(hoverRule).toBeTruthy();
  expect(hoverRule).toMatch(
    /background:\s*var\(--goose-interactive-(?:hover|selected)\)/,
  );
  expect(hoverRule).not.toContain("--bui-hover-2");
});

test("Composer / Skill 建议项 hover 嵌套文字用强调色前景", () => {
  for (const path of SUGGESTION_SOURCES) {
    expect(readFileSync(path, "utf8"), path).toContain(HOVER_NESTED_SELECTED_FG);
  }
});

test("斜杠菜单常规项 hover 嵌套文字用强调色前景", () => {
  expect(readFileSync("src/components/editor/core/CustomSlashMenu.tsx", "utf8")).toContain(
    HOVER_NESTED_SELECTED_FG,
  );
});

test("侧栏重新加载 hover 用强调色前景", () => {
  expect(
    readFileSync(
      "src/pages/workspace/components/sidebar/main-tree/SidebarMainTree.tsx",
      "utf8",
    ),
  ).toContain(HOVER_SELECTED_FG);
});

test("对话框与抽屉关闭钮 hover 用强调色前景", () => {
  for (const path of CLOSE_BUTTON_SOURCES) {
    expect(readFileSync(path, "utf8"), path).toContain(HOVER_SELECTED_FG);
  }
});

test("Callout 图标与单标签标题 hover 用强调色前景", () => {
  expect(
    readFileSync("src/components/editor/blocks/callout/calloutBlock.tsx", "utf8"),
  ).toContain(HOVER_SELECTED_FG);
  expect(
    readFileSync(
      "src/pages/workspace/components/page/SingleTabTitle.tsx",
      "utf8",
    ),
  ).toContain(HOVER_SELECTED_FG);
});
