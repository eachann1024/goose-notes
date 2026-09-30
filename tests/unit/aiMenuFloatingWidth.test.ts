import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import {
  AI_MENU_MAX_WIDTH_PX,
  AI_MENU_MIN_WIDTH_PX,
  computeAiMenuFloatingWidth,
} from "../../src/components/editor/ai/aiMenuFloatingWidth";

test("大屏窄块仍保持 468 舒适下限", () => {
  expect(
    computeAiMenuFloatingWidth({
      viewportWidth: 1440,
      availableWidth: 200,
    }),
  ).toBe(AI_MENU_MIN_WIDTH_PX);
});

test("大屏足够空间时取 91vw 并封顶 1248", () => {
  expect(
    computeAiMenuFloatingWidth({
      viewportWidth: 2000,
      availableWidth: 1800,
    }),
  ).toBe(AI_MENU_MAX_WIDTH_PX);
  expect(
    computeAiMenuFloatingWidth({
      viewportWidth: 800,
      availableWidth: 800,
    }),
  ).toBe(728);
});

test("速记小窗默认 480 与最小 320 不超出视口", () => {
  expect(
    computeAiMenuFloatingWidth({
      viewportWidth: 480,
      availableWidth: 480,
    }),
  ).toBeLessThanOrEqual(464);
  expect(
    computeAiMenuFloatingWidth({
      viewportWidth: 320,
      availableWidth: 320,
    }),
  ).toBeLessThanOrEqual(304);
});

test("可用宽度更窄时跟着收缩，避免小窗裁切", () => {
  expect(
    computeAiMenuFloatingWidth({
      viewportWidth: 320,
      availableWidth: 260,
    }),
  ).toBeLessThanOrEqual(252);
});

test("行内 AI 样式随菜单控制器加载，不再只挂在主窗入口", () => {
  const controller = readFileSync(
    "src/components/editor/ai/GooseAIMenuController.tsx",
    "utf8",
  );
  const indexEntry = readFileSync("src/index-entry.tsx", "utf8");
  expect(controller).not.toContain("@blocknote/xl-ai");
  expect(controller).toContain("GooseAIExtension");
  expect(controller).toContain("@/pages/workspace/styles/editor-ai-menu.css");
  expect(indexEntry).not.toContain("@blocknote/xl-ai/style.css");
});

test("AI 菜单 CSS 下限可随视口收缩", () => {
  const css = readFileSync(
    "src/pages/workspace/styles/editor-ai-menu.css",
    "utf8",
  );
  expect(css).toContain("min-width: min(468px, 100%)");
  expect(css).toContain("min-width: min(468px, 91vw, calc(100vw - 16px))");
  expect(css).not.toMatch(/\.bn-combobox\s*\{[^}]*min-width:\s*468px;/);
});
