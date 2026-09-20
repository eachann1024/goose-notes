import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("侧栏底栏不再画顶部分隔线和描边卡片", () => {
  const footer = readFileSync(
    "src/pages/workspace/components/sidebar/SidebarFooter.tsx",
    "utf8",
  );
  expect(footer).not.toContain("<NotebookSwitcher");
  expect(footer).not.toContain("border-t");
  expect(footer).not.toContain("rounded-xl");
  expect(footer).toContain("px-2 pb-0 pt-1");
});

test("笔记本切换在侧栏顶部：名称在左，chevron 在右", () => {
  const switcher = readFileSync(
    "src/pages/workspace/components/sidebar/NotebookSwitcher.tsx",
    "utf8",
  );
  expect(switcher).toContain("ChevronDown");
  expect(switcher).toContain("ChevronUp");
  expect(switcher).not.toMatch(/>\s*当前笔记本\s*</);
  expect(switcher).toContain("truncate tracking-[0.01em] leading-snug");
  expect(switcher).toContain("sidebar-notebook-trigger");
  expect(switcher).toContain("h-9 w-full");
  const css = readFileSync("src/pages/workspace/components/sidebar/notebook-switcher.css", "utf8");
  expect(switcher).toContain("w-[calc(var(--goose-popover-trigger-width)+14px)]");
  expect(switcher).toContain("alignOffset={-7}");
  expect(switcher).toContain("sideOffset={0}");
  expect(switcher).toContain('className="goose-notebook-shell"');
  expect(css).toContain("box-shadow: var(--goose-menu-shadow)");
  expect(css).not.toContain("outline: 1px solid currentColor");
  expect(switcher).toContain('side="bottom"');
  expect(switcher).toContain('animation="reveal"');
});

test("底部留白由侧栏和编辑面板的共同容器提供，避免满高面板加 margin 溢出", () => {
  const css = readFileSync("src/pages/workspace/styles/index.css", "utf8");
  expect(css).toContain("padding: 10px 10px 12px var(--workspace-stage-pad-left)");
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
