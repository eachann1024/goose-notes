import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("Electron 菜单 Cmd+W 关标签，不关窗口", () => {
  const index = readFileSync(
    new URL("../../electron/main/index.ts", import.meta.url),
    "utf8",
  );
  const windows = readFileSync(
    new URL("../../electron/main/windows.ts", import.meta.url),
    "utf8",
  );
  const hotkeys = readFileSync(
    new URL("../../src/hooks/useAppHotkeys.ts", import.meta.url),
    "utf8",
  );
  const preload = readFileSync(
    new URL("../../electron/preload/index.ts", import.meta.url),
    "utf8",
  );

  expect(index).not.toContain('{ role: "close" }');
  expect(index).not.toContain("role: \"windowMenu\"");
  expect(index).toContain("关闭标签");
  expect(index).toContain("CLOSE_TAB_ACCELERATOR");
  expect(index).toContain("CLOSE_WINDOW_ACCELERATOR");
  expect(index).toContain("requestCloseActiveTab");

  expect(windows).toContain("before-input-event");
  expect(windows).toContain("isPrimaryModW");
  expect(windows).toContain("CLOSE_ACTIVE_TAB_CHANNEL");
  expect(windows).toContain('kind === "quicknote"');
  const quicknoteClose = windows.slice(
    windows.indexOf('if (context?.kind === "quicknote")'),
    windows.indexOf("if (win.webContents.isDestroyed())"),
  );
  expect(
    quicknoteClose.indexOf("markQuicknoteActivateSuppressed();"),
  ).toBeLessThan(quicknoteClose.indexOf("win.close();"));

  expect(hotkeys).toContain('matchShortcut(normalized, "Mod+W")');
  expect(hotkeys).toContain("onCloseActiveTab");
  expect(hotkeys).toContain("runUnifiedClose");
  expect(hotkeys).toContain("if (closeNotebookAiPanel())");
  expect(hotkeys).not.toContain("getFocusedAiPanelLayout");
  expect(hotkeys).toContain("closePaneOrTab");
  expect(hotkeys).toContain("closeTab(activeId)");
  expect(hotkeys).toContain("findLoneVisibleWorkspaceTab");
  expect(hotkeys).toContain("loneVisibleTab?.id === activeId");
  expect(hotkeys).toContain("closeWindow?.()");
  expect(hotkeys).toContain('closePaneOrTab() !== "close-tab"');

  expect(preload).toContain("desktop:close-active-tab");
  expect(preload).toContain("onCloseActiveTab");
});

test("选中标签没有底条或下划线", () => {
  const css = readFileSync(
    new URL("../../src/pages/workspace/styles/index.css", import.meta.url),
    "utf8",
  );
  expect(css).not.toContain('[data-tab-active="true"]::after');
  expect(css).not.toContain("选中底条");
  expect(css).toContain("border-bottom: none");
  expect(css).toContain("text-decoration: none");
});
