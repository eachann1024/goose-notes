import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import { loadInternalPage } from "../../src/lib/storage/pageRepository";
import { usePages } from "../../src/stores/usePages";
import type { Page } from "../../src/types";
import {
  clearElectronLocalStorageRuntime,
  installElectronLocalStorageRuntime,
} from "./electronLocalStorageRuntime";

const editorCss = readFileSync(
  new URL(
    "../../src/pages/workspace/styles/editor-base/inline.css",
    import.meta.url,
  ),
  "utf8",
);

const workspaceLayout = readFileSync(
  new URL("../../src/pages/workspace/WorkspaceLayout.tsx", import.meta.url),
  "utf8",
);

function page(id: string, fontFamily: Page["fontFamily"] = "default"): Page {
  return {
    id,
    workspaceId: "font-scope-test",
    content: [{ type: "paragraph", content: id }],
    isLocked: false,
    fontSize: "default",
    fontFamily,
    createdAt: 1,
    updatedAt: 1,
  };
}

test.afterEach(() => {
  clearElectronLocalStorageRuntime();
  usePages.setState({ pages: {}, activePageId: null });
});

test("分屏字体只由各自页面决定，旧活动页祖先属性会稳定复现串页", async ({
  page: browserPage,
}) => {
  await browserPage.setContent(`
    <style>
      :root {
        --font-default: Arial;
        --font-serif: Georgia;
        --font-mono: "Courier New";
      }
      ${editorCss}
    </style>
    <div class="workspace-editor-surface" data-split-host>
      <div class="editor-split-pane">
        <div class="editor-split-pane-body">
          <div class="workspace-editor-surface" data-font-family="default">
            <div class="bn-editor" data-page="default">默认</div>
          </div>
        </div>
      </div>
      <div class="editor-split-pane">
        <div class="editor-split-pane-body">
          <div class="workspace-editor-surface" data-font-family="serif">
            <div class="bn-editor" data-page="serif">衬线</div>
          </div>
        </div>
      </div>
      <div class="editor-split-pane">
        <div class="editor-split-pane-body">
          <div class="workspace-editor-surface" data-font-family="mono">
            <div class="bn-editor" data-page="mono">等宽</div>
          </div>
        </div>
      </div>
    </div>
  `);

  const families = await browserPage
    .locator(".bn-editor")
    .evaluateAll((editors) =>
      editors.map((editor) => getComputedStyle(editor).fontFamily),
    );

  expect(families[0]).toContain("Arial");
  expect(families[1]).toContain("Georgia");
  expect(families[2]).toContain("Courier New");

  // 旧实现把 activePage 的属性挂到这个公共祖先；mono selector 在真实
  // inline.css 中位于最后，会压过两格内层的 default / serif selector。
  await browserPage.locator("[data-split-host]").evaluate((host) => {
    host.setAttribute("data-font-family", "mono");
  });
  const leakedFamilies = await browserPage
    .locator(".bn-editor")
    .evaluateAll((editors) =>
      editors.map((editor) => getComputedStyle(editor).fontFamily),
    );

  expect(leakedFamilies[0]).toContain("Courier New");
  expect(leakedFamilies[1]).toContain("Courier New");
  expect(leakedFamilies[2]).toContain("Courier New");

  await browserPage.locator("[data-split-host]").evaluate((host) => {
    host.removeAttribute("data-font-family");
  });
  const restoredFamilies = await browserPage
    .locator(".bn-editor")
    .evaluateAll((editors) =>
      editors.map((editor) => getComputedStyle(editor).fontFamily),
    );

  expect(restoredFamilies[0]).toContain("Arial");
  expect(restoredFamilies[1]).toContain("Georgia");
  expect(restoredFamilies[2]).toContain("Courier New");
});

test("分屏宿主不再把 activePage 的字体属性挂到所有编辑器祖先", () => {
  const splitColumn = workspaceLayout.slice(
    workspaceLayout.indexOf("function NotebookEditorSplitColumn"),
    workspaceLayout.indexOf("function NotebookAiWorkspaceBody"),
  );

  expect(splitColumn).not.toContain("data-font-family");
});

test("按页面 id 更新字体只持久化目标笔记", () => {
  installElectronLocalStorageRuntime();
  usePages.setState({
    pages: {
      focused: page("focused", "default"),
      neighbor: page("neighbor", "mono"),
    },
    activePageId: "focused",
  });

  usePages.getState().updatePage("focused", { fontFamily: "serif" });

  expect(usePages.getState().pages.focused?.fontFamily).toBe("serif");
  expect(usePages.getState().pages.neighbor?.fontFamily).toBe("mono");
  expect(loadInternalPage("focused")?.fontFamily).toBe("serif");
  expect(loadInternalPage("neighbor")).toBeNull();
});
