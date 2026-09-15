import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";

const readSource = (path: string) => readFileSync(path, "utf8");

test("焦点在 AI 侧栏或全屏面板内可判定", async () => {
  const { isFocusInsideAiPanel, getFocusedAiPanelLayout } = await import(
    "../../src/pages/workspace/components/notebook-ai/aiPanelFocus"
  );

  function host(layout: "side-panel" | "fullscreen" | null) {
    return {
      closest(selector: string) {
        if (!layout) return null;
        if (selector === `[data-ai-panel-layout="${layout}"]`) return this;
        if (selector === "[data-ai-panel-layout]") return this;
        return null;
      },
      getAttribute(name: string) {
        return name === "data-ai-panel-layout" ? layout : null;
      },
    };
  }

  const composer = host("side-panel");
  const message = host("fullscreen");
  const editor = host(null);

  expect(isFocusInsideAiPanel(composer, "side-panel")).toBe(true);
  expect(isFocusInsideAiPanel(composer, "fullscreen")).toBe(false);
  expect(isFocusInsideAiPanel(message, "fullscreen")).toBe(true);
  expect(isFocusInsideAiPanel(editor)).toBe(false);
  expect(getFocusedAiPanelLayout(composer)).toBe("side-panel");
  expect(getFocusedAiPanelLayout(message)).toBe("fullscreen");
  expect(getFocusedAiPanelLayout(editor)).toBeNull();
  const targetWithoutAttributes = { closest: () => ({ closest: () => null }) };
  expect(getFocusedAiPanelLayout(targetWithoutAttributes as unknown as EventTarget)).toBeNull();
});

test("关 AI 面板只收起 UI，不 stop 会话", () => {
  const hook = readSource(
    "src/pages/workspace/components/notebook-ai/useNotebookAiPanel.ts",
  );
  const closeBlock = hook.slice(
    hook.indexOf("const close = useCallback"),
    hook.indexOf("const toggle = useCallback"),
  );
  expect(closeBlock).toContain("setIsOpen(false)");
  expect(closeBlock).not.toMatch(/\bstop\s*\(/);
  expect(closeBlock).not.toMatch(/\babort\s*\(/);
  expect(hook).toContain("export function closeNotebookAiPanel");
  expect(hook).toContain("goose-note:close-ai-panel");
});

test("全屏 AI 失焦后 Escape 走窗口监听关闭面板", () => {
  const panel = readSource(
    "src/pages/workspace/components/notebook-ai/NotebookAiPanel.tsx",
  );
  const listener = panel.slice(
    panel.indexOf("全屏覆盖主区"),
    panel.indexOf("const composerPlaceholder"),
  );
  expect(listener).toContain("if (!isFullscreen) return");
  expect(listener).toContain('window.addEventListener("keydown", onKeyDown)');
  expect(listener).toContain('event.key !== "Escape"');
  expect(listener).toContain("isImeKeyboardEvent(event)");
  expect(listener).toContain('[role="dialog"][data-state="open"]');
  expect(listener).toContain("onClose()");
});

test("AI 面板挂载时标记任务面，卸载时清标记并收起浮层", () => {
  const panel = readSource(
    "src/pages/workspace/components/notebook-ai/NotebookAiPanel.tsx",
  );
  const surface = readSource(
    "src/pages/workspace/components/notebook-ai/aiPanelSurface.ts",
  );

  expect(panel).toContain("setAiPanelSurface({ active: true, fullscreen: isFullscreen })");
  expect(panel).toContain("clearAiPanelSurface()");
  expect(panel).toContain("dismissAiFloatingLayers(root)");
  expect(surface).toContain('export const AI_PANEL_ACTIVE_ATTR = "data-goose-ai-panel-active"');
  expect(surface).toContain('export const AI_FULLSCREEN_ATTR = "data-goose-ai-fullscreen"');
  expect(surface).toContain(".goose-code-floating-toolbar");
  expect(surface).toContain("[data-formatting-toolbar]");
  expect(surface).toContain('[data-streamdown="code-block-actions"]');
  expect(surface).toContain('[data-streamdown="mermaid-block-actions"]');
});

test("加入对话在侧栏关闭时强制打开并排布局", () => {
  const layout = readSource("src/pages/workspace/WorkspaceLayout.tsx");
  const quote = readSource(
    "src/components/editor/ai/composer/selectionQuote.ts",
  );
  expect(layout).toContain('record?.layout === "side-panel"');
  expect(layout).toContain('setAiLayoutMode("side-panel")');
  expect(quote).toContain('detail: { layout: "side-panel" }');
  expect(quote).toContain("consumePendingAppendComposerSelections");
  expect(quote).toContain("FOCUS_AI_COMPOSER_EVENT");
});

test("加入对话与打开面板会刷新过期会话并聚焦输入框", () => {
  const session = readSource(
    "src/pages/workspace/components/notebook-ai/NotebookAiSession.tsx",
  );
  const panel = readSource(
    "src/pages/workspace/components/notebook-ai/NotebookAiPanel.tsx",
  );
  const composer = readSource(
    "src/pages/workspace/components/notebook-ai/Composer.tsx",
  );
  const chats = readSource("src/stores/useNotebookAiChats.ts");

  expect(chats).toContain("30 * 60 * 1000");
  expect(session).toContain("ensureFreshConversation");
  expect(session).toContain("OPEN_AI_PANEL_EVENT");
  expect(panel).toContain("ensureFreshOnOpenRef.current()");
  expect(panel).toContain("conversationId={conversationId}");
  expect(composer).toContain("shouldDeferPendingSelectionQuote");
  expect(composer).toContain("inputRef.current?.focus()");
});

test("切走 AI / 开设置时隐藏文字工具栏及同类浮动层", () => {
  const css = readSource("src/pages/workspace/styles/editor-base/overlays.css");

  expect(css).toContain(
    "body:is([data-goose-settings-open], [data-goose-ai-fullscreen]) [data-formatting-toolbar]",
  );
  expect(css).toContain(
    "body:is([data-goose-settings-open], [data-goose-ai-fullscreen]) .goose-code-floating-toolbar",
  );
  expect(css).toContain(
    "body:is([data-goose-settings-open], [data-goose-ai-fullscreen]) .goose-ai-menu-floating",
  );
  expect(css).toContain(
    'body:not([data-goose-ai-panel-active]) [data-streamdown="code-block-actions"]',
  );
  expect(css).toContain(
    'body:not([data-goose-ai-panel-active]) [data-streamdown="mermaid-block-actions"]',
  );
  expect(css).toContain(
    'body:not([data-goose-ai-panel-active]) [data-streamdown="table-fullscreen"]',
  );
});
