import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

const panelSource = readFileSync(
  "src/pages/workspace/components/notebook-ai/NotebookAiPanel.tsx",
  "utf8",
);
const composerSource = readFileSync(
  "src/pages/workspace/components/notebook-ai/Composer.tsx",
  "utf8",
);
const css = readFileSync("src/pages/workspace/styles/notebook-ai.css", "utf8");

test("AI 消息区跟随 --editor-scale 做 CSS zoom，输入条不包进去", () => {
  expect(panelSource).toContain("notebook-ai-zoom-slot");
  expect(panelSource).toContain('className="notebook-ai-zoom-surface"');
  expect(panelSource).toContain("<ChatMessages");

  const slotAt = panelSource.indexOf("notebook-ai-zoom-slot");
  const messagesAt = panelSource.indexOf("<ChatMessages", slotAt);
  const composerAt = panelSource.indexOf("<Composer", slotAt);
  expect(messagesAt).toBeGreaterThan(slotAt);
  expect(composerAt).toBeGreaterThan(messagesAt);
  expect(panelSource).toContain('className="notebook-ai-composer-dock"');
  expect(composerAt).toBeGreaterThan(
    panelSource.indexOf('className="notebook-ai-composer-dock"'),
  );

  expect(css).toContain("zoom: var(--editor-scale, 1)");
  expect(css).toContain(".notebook-ai-composer-dock {");
});

test("侧栏输入条与标题白块共用 8px 内边，拖宽手柄落在缝上", () => {
  expect(panelSource).toContain("AiPanelResizeEdge");
  expect(panelSource).toContain("onDragHandlePointerDown");
  expect(panelSource).toContain("effectiveWidth");
  expect(composerSource).toContain('"px-0 pb-2"');
  expect(css).toContain(
    '[data-ai-panel-layout="side-panel"] .notebook-ai-composer-dock',
  );
  expect(css).toContain("left: 0.5rem");
  expect(css).toContain("right: 0.5rem");
});

test("zoom 面不做反比宽高补偿：zoom 已缩放布局盒，再补偿会缩两次", () => {
  const surfaceAt = css.indexOf(".notebook-ai-zoom-surface {");
  expect(surfaceAt).toBeGreaterThan(-1);
  const surfaceRule = css.slice(surfaceAt, css.indexOf("}", surfaceAt));

  expect(surfaceRule).toContain("zoom: var(--editor-scale, 1)");
  expect(surfaceRule).toContain("width: 100%");
  expect(surfaceRule).toContain("height: 100%");
  expect(css).not.toContain("calc(100% / var(--editor-scale");
});
