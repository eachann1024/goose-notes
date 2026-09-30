import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

const scaffold = readFileSync("src/pages/workspace/components/sidebar/settings/SettingsScaffold.tsx", "utf8");
const workspace = readFileSync("src/pages/workspace/WorkspaceLayout.tsx", "utf8");
const css = readFileSync("src/pages/workspace/styles/index.css", "utf8");

test("设置关闭钮有独立可访问名称和强调色 hover", () => {
  const closeButton = scaffold.slice(scaffold.indexOf('aria-label="关闭设置"') - 380, scaffold.indexOf('aria-label="关闭设置"') + 90);
  expect(closeButton).toContain("hover:bg-[var(--goose-interactive-hover)]");
  expect(closeButton).toContain("hover:text-[var(--goose-interactive-hover-fg)]");
  expect(closeButton).toContain("onClick={onClose}");
});

test("设置门户使用现有原生顶栏与主区，不创建第二个 workspace shell", () => {
  expect(scaffold).toContain("sidebarContainer && createPortal(");
  expect(scaffold).toContain("mainContainer && createPortal(");
  expect(scaffold).not.toContain("workspace-shell");
  expect(scaffold).not.toContain("electron-titlebar");
  expect(workspace).toContain("<DesktopTitleBar");
  expect(workspace).toContain("settingsOpen={settingsOpen}");
  expect(workspace).toContain('className="workspace-main-sheet');
});

test("设置沿用主界面顶部布局；后台编辑器保持挂载并隐藏", () => {
  expect(css).toContain(".workspace-shell[data-settings] .workspace-stage");
  expect(css).toContain("padding-top: 0");
  expect(scaffold).toContain('className="settings-shell absolute inset-0');
  expect(workspace).toContain('settingsOpen && "invisible"');
  expect(workspace).toContain("editorHost.inert = settingsOpen");
  expect(workspace).not.toContain("!settingsOpen && <NotebookAiSessionProvider");
});
