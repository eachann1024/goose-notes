import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("侧栏底栏不再画顶部分隔线和描边卡片", () => {
  const footer = readFileSync(
    "src/pages/workspace/components/sidebar/SidebarFooter.tsx",
    "utf8",
  );
  expect(footer).toContain("<NotebookSwitcher {...props}");
  expect(footer).not.toContain("border-t");
  expect(footer).not.toContain("rounded-xl");
  expect(footer).not.toContain("pb-2");
  expect(footer).toContain("pt-2");
});

test("笔记本切换是左右停靠：名称在左，右侧切换钮", () => {
  const switcher = readFileSync(
    "src/pages/workspace/components/sidebar/NotebookSwitcher.tsx",
    "utf8",
  );
  expect(switcher).toContain("ChevronsUpDown");
  expect(switcher).toContain("rounded-lg");
  expect(switcher).toContain("h-7 w-7");
  expect(switcher).not.toContain("ChevronDown");
  expect(switcher).not.toMatch(/>\s*当前笔记本\s*</);
  expect(switcher).toContain("min-w-0 flex-1 truncate leading-snug");
  expect(switcher).toContain("bg-[var(--workspace-main-surface)]");
  expect(switcher).toContain("min-h-10");
  expect(switcher).toContain("title={activeNotebook?.name}");
  const css = readFileSync("src/pages/workspace/components/sidebar/notebook-switcher.css", "utf8");
  // 菜单两侧各 6px 内距 + 1px 边框，内容宽度必须等于原入口。
  expect(switcher).toContain("w-[calc(var(--goose-popover-trigger-width)+14px)]");
  expect(switcher).toContain("alignOffset={-7}");
  expect(switcher).toContain("sideOffset={0}");
  expect(switcher).not.toContain("minWidth: 220");
  expect(css).toContain("padding: 6px");
  expect(css).toContain(".sidebar-notebook-trigger:focus-visible");
  expect(css).toContain("outline: 1px solid currentColor");
  expect(css).toContain(".goose-notebook-shell");
  expect(css).toContain('.sidebar-notebook-trigger[data-present="true"]');
  expect(css).not.toContain("::before");
  expect(switcher).not.toContain("focus-visible:ring");
  expect(switcher).toContain("focus-visible:bg-muted");
  expect(switcher).not.toContain("focus-visible:underline");
  expect(switcher).toContain('animation="reveal"');
});

test("底部留白由侧栏和编辑面板的共同容器提供，避免满高面板加 margin 溢出", () => {
  const css = readFileSync("src/pages/workspace/styles/index.css", "utf8");
  expect(css).toContain("padding: 10px 10px var(--workspace-stage-pad-bottom) var(--workspace-stage-pad-left)");
  expect(css).not.toContain("margin-bottom: var(--workspace-stage-pad-bottom)");
});


test("Popover 退出保留 DOM 但立即退出交互，定位 transform 不由 Motion 改写", () => {
  const popover = readFileSync("src/components/ui/popover.tsx", "utf8");
  expect(popover).toContain("useTransitionStatus(floating.context");
  expect(popover).toContain("hidden={!state.isMounted}");
  expect(popover).toContain("inert={!state.open}");
  expect(popover).toContain("disabled={!state.open}");
  expect(popover).toContain("pointerEvents: state.open ? style?.pointerEvents : \"none\"");
  expect(popover).toContain("const keyboard = React.useRef(true)");
  expect(popover).toContain("useReducedMotion()");
  expect(popover).toContain("...state.floatingStyles");
  expect(popover).toContain("transform: false");
  expect(popover).toContain("floatingMenuMotionStyle");
  expect(popover).not.toMatch(/animate\([\s\S]*?transform:/);
});
