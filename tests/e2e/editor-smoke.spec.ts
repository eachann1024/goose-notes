import { expect, test, type Page } from "playwright/test";

const isMac = process.platform === "darwin";
const commandKey = isMac ? "Meta" : "Control";

async function openWorkspace(page: Page) {
  await page.goto("/");
  await expect(page.locator(".ProseMirror").first()).toBeVisible();
}

async function createFreshPage(page: Page) {
  const newPageButton = page.getByRole("button", { name: "新建页面" }).first();
  await expect(newPageButton).toBeVisible();
  await newPageButton.click();
  await expect(page.locator(".ProseMirror").first()).toBeVisible();
}

async function focusEditorParagraph(page: Page) {
  const editor = page.locator(".ProseMirror").first();
  await expect(editor).toBeVisible();
  await editor.locator("p").last().click();
  return editor;
}

async function flushEditor(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("goose-note:flush-editor", {
        detail: { immediate: true },
      }),
    );
  });
  await page.waitForTimeout(600);
}

async function pasteText(page: Page, text: string, html?: string) {
  await page.evaluate(
    ({ plainText, htmlText }) => {
      const editor = document.querySelector(".ProseMirror");
      if (!editor) {
        throw new Error("Editor not found");
      }

      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", plainText);
      if (htmlText) {
        clipboardData.setData("text/html", htmlText);
      }

      const pasteEvent = new ClipboardEvent("paste", {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });

      editor.dispatchEvent(pasteEvent);
    },
    { plainText: text, htmlText: html },
  );
}

async function setListContentAndGetTextRanges(page: Page) {
  return await page.evaluate(() => {
    const editor = (window as any).__gooseNoteEditor;
    if (!editor) {
      throw new Error("Editor instance not found");
    }

    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "苹果" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "香蕉" }],
                },
              ],
            },
          ],
        },
      ],
    });

    const ranges: { from: number; to: number; text: string }[] = [];
    editor.state.doc.descendants((node: any, pos: number) => {
      if (node.isText && (node.text === "苹果" || node.text === "香蕉")) {
        ranges.push({
          from: pos,
          to: pos + node.text.length,
          text: node.text,
        });
      }
      return true;
    });

    if (ranges.length !== 2) {
      throw new Error(`Unexpected list text range length: ${ranges.length}`);
    }

    return {
      firstFrom: ranges[0].from,
      firstTo: ranges[0].to,
      secondFrom: ranges[1].from,
      secondTo: ranges[1].to,
    };
  });
}

async function setMultilineListItemContentAndGetTextRanges(page: Page) {
  return await page.evaluate(() => {
    const editor = (window as any).__gooseNoteEditor;
    if (!editor) {
      throw new Error("Editor instance not found");
    }

    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "123" },
                    { type: "hardBreak" },
                    { type: "hardBreak" },
                    { type: "text", text: "2323" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const ranges: { from: number; to: number; text: string }[] = [];
    editor.state.doc.descendants((node: any, pos: number) => {
      if (node.isText && (node.text === "123" || node.text === "2323")) {
        ranges.push({
          from: pos,
          to: pos + node.text.length,
          text: node.text,
        });
      }
      return true;
    });

    if (ranges.length !== 2) {
      throw new Error(`Unexpected multiline list range length: ${ranges.length}`);
    }

    return {
      firstFrom: ranges[0].from,
      secondTo: ranges[1].to,
    };
  });
}

async function copySelectionPlainText(
  page: Page,
  from: number,
  to: number,
): Promise<string> {
  return await page.evaluate(({ fromPos, toPos }) => {
    const editor = (window as any).__gooseNoteEditor;
    if (!editor) {
      throw new Error("Editor instance not found");
    }

    editor.commands.setTextSelection({ from: fromPos, to: toPos });
    const clipboardData = new DataTransfer();
    const copyEvent = new ClipboardEvent("copy", {
      clipboardData,
      bubbles: true,
      cancelable: true,
    });
    editor.view.dom.dispatchEvent(copyEvent);
    return clipboardData.getData("text/plain");
  }, { fromPos: from, toPos: to });
}

async function setCodeBlockContent(
  page: Page,
  language: string,
  code: string,
) {
  await page.evaluate(
    ({ lang, content }) => {
      const editor = (window as any).__gooseNoteEditor;
      if (!editor) {
        throw new Error("Editor instance not found");
      }

      editor.commands.setContent({
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: { language: lang },
            content: [{ type: "text", text: content }],
          },
        ],
      });
    },
    { lang: language, content: code },
  );
}

async function getFirstCodeBlockAttrs(page: Page): Promise<{
  language: string;
  collapsed: boolean;
  summary: string;
}> {
  return await page.evaluate(() => {
    const editor = (window as any).__gooseNoteEditor;
    if (!editor) {
      throw new Error("Editor instance not found");
    }

    let language = "";
    let collapsed = false;
    let summary = "";
    editor.state.doc.descendants((node: any) => {
      if (node.type.name === "codeBlock") {
        language = node.attrs.language || "";
        collapsed = node.attrs.collapsed === true || node.attrs.collapsed === "true";
        summary =
          typeof node.attrs.summary === "string" ? node.attrs.summary : "";
        return false;
      }
      return true;
    });

    return { language, collapsed, summary };
  });
}

async function getFirstCodeBlockLanguage(page: Page): Promise<string> {
  const attrs = await getFirstCodeBlockAttrs(page);
  return attrs.language;
}

test.describe("编辑器 P0 冒烟", () => {
  test("输入与保存流程可执行", async ({ page }) => {
    await openWorkspace(page);
    await createFreshPage(page);
    const bodyText = `回归测试文本-A-${Date.now()}`;
    await focusEditorParagraph(page);
    await page.keyboard.insertText(bodyText);
    await page.waitForTimeout(800);
    await flushEditor(page);
    await expect(page.locator(".ProseMirror").first()).toContainText(bodyText);
  });

  test("撤销与重做保持可用", async ({ page }) => {
    await openWorkspace(page);
    await createFreshPage(page);
    const editor = await focusEditorParagraph(page);

    await page.keyboard.type("ABC");
    await expect(editor).toContainText("ABC");

    await page.keyboard.press(`${commandKey}+z`);
    await expect(editor).not.toContainText("ABC");

    if (isMac) {
      await page.keyboard.press("Meta+Shift+z");
    } else {
      await page.keyboard.press("Control+y");
    }
    await expect(editor).toContainText("ABC");
  });

  test("Slash 命令可插入表格", async ({ page }) => {
    await openWorkspace(page);
    await createFreshPage(page);
    await focusEditorParagraph(page);

    await page.keyboard.type("/table");
    await page.keyboard.press("Enter");

    await expect(page.locator(".ProseMirror table")).toHaveCount(1);
  });

  test("Markdown 粘贴可识别列表与待办", async ({ page }) => {
    await openWorkspace(page);
    await createFreshPage(page);
    const editor = await focusEditorParagraph(page);

    await pasteText(page, "- item1\n1. item2\n- [ ] todo");

    await expect(editor).toContainText("item1");
    await expect(editor).toContainText("item2");
    await expect(editor).toContainText("todo");
    await expect(editor.locator("ol li").first()).toContainText("item2");
    await expect(editor.locator('input[type="checkbox"]').first()).toBeVisible();
  });

  test("链接粘贴会生成可点击链接", async ({ page }) => {
    await openWorkspace(page);
    await createFreshPage(page);
    await focusEditorParagraph(page);

    await pasteText(page, "https://example.com");

    await expect(
      page.locator('.ProseMirror a[href^="https://example.com"]'),
    ).toHaveCount(1);
  });

  test("链接工具栏支持编辑与复制", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openWorkspace(page);
    await createFreshPage(page);
    await focusEditorParagraph(page);

    await pasteText(page, "https://example.com");

    const link = page.locator('.ProseMirror a[href="https://example.com"]').first();
    await expect(link).toBeVisible();
    await link.hover();

    const linkToolbar = page.locator("[data-link-hover-menu]");
    await expect(linkToolbar).toBeVisible();

    await linkToolbar.getByRole("button", { name: "编辑链接" }).click();

    const nextTitle = `示例链接-${Date.now()}`;
    const nextUrl = `https://example.org/docs/${Date.now()}`;

    await page.getByPlaceholder("链接文字").fill(nextTitle);
    await page.getByPlaceholder("https://...").fill(nextUrl);
    await page.getByRole("button", { name: "保存" }).click();

    const editedLink = page
      .locator(`.ProseMirror a[href="${nextUrl}"]`)
      .filter({ hasText: nextTitle })
      .first();
    await expect(editedLink).toBeVisible();

    await editedLink.hover();
    await expect(linkToolbar).toBeVisible();
    await linkToolbar.getByRole("button", { name: "复制链接" }).click();

    await expect
      .poll(
        async () => page.evaluate(async () => navigator.clipboard.readText()),
        { timeout: 5_000 },
      )
      .toBe(nextUrl);
  });

  test("表格内 Tab 可切换到下一个单元格", async ({ page }) => {
    await openWorkspace(page);
    await createFreshPage(page);
    await focusEditorParagraph(page);
    await pasteText(page, "| H1 | H2 |\n| --- | --- |\n| A1 | B1 |");

    const table = page.locator(".ProseMirror table").first();
    await expect(table).toBeVisible();
    const firstCell = table.locator("th, td").first();
    const secondCell = table.locator("th, td").nth(1);

    await firstCell.click();
    await page.keyboard.type("A");
    await page.keyboard.press("Tab");
    await page.keyboard.type("B");

    await expect(firstCell).toContainText("A");
    await expect(secondCell).toContainText("B");
  });

  test("单行列表复制不带前缀符号", async ({ page }) => {
    await openWorkspace(page);
    await createFreshPage(page);
    const { firstFrom, firstTo, secondTo } = await setListContentAndGetTextRanges(
      page,
    );

    const singleLineText = await copySelectionPlainText(page, firstFrom, firstTo);
    expect(singleLineText).toBe("苹果");

    const multiLineText = await copySelectionPlainText(page, firstFrom, secondTo);
    expect(multiLineText).toContain("- 苹果");
    expect(multiLineText).toContain("- 香蕉");
  });

  test("同列表项跨多行复制保留列表格式", async ({ page }) => {
    await openWorkspace(page);
    await createFreshPage(page);
    const { firstFrom, secondTo } = await setMultilineListItemContentAndGetTextRanges(
      page,
    );

    const multiLineText = await copySelectionPlainText(page, firstFrom, secondTo);
    expect(multiLineText).toContain("- 123");
    expect(multiLineText).toContain("2323");
    expect(multiLineText).not.toContain("\\");
  });

  test("代码块工具栏在代码块 hover 时显示", async ({ page }) => {
    await openWorkspace(page);
    await createFreshPage(page);
    await setCodeBlockContent(
      page,
      "javascript",
      `const veryLongLine = "${"x".repeat(240)}";`,
    );

    const editor = page.locator(".ProseMirror").first();
    const codeBlock = editor.locator(".code-block-node").first();
    const content = codeBlock.locator(".code-block-content").first();
    const toolbarRow = codeBlock.locator(".code-block-toolbar-row").first();
    const toolbarActions = codeBlock.locator(".code-block-toolbar-actions").first();

    await expect(content).toBeVisible();
    await expect(toolbarRow).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(toolbarActions).toHaveCSS("opacity", "0");
    await codeBlock.hover();
    await expect(toolbarActions).toHaveCSS("opacity", "1");
    await expect(toolbarActions).toBeVisible();
    await expect(toolbarActions.locator("button").first()).toBeVisible();

    const contentBox = await content.boundingBox();
    const toolbarRowBox = await toolbarRow.boundingBox();
    const toolbarActionsBox = await toolbarActions.boundingBox();
    if (!contentBox || !toolbarRowBox || !toolbarActionsBox) {
      throw new Error("Code block layout not ready");
    }
    expect(toolbarRowBox.y + toolbarRowBox.height).toBeLessThanOrEqual(contentBox.y);
    expect(toolbarActionsBox.x + toolbarActionsBox.width).toBeGreaterThan(
      toolbarRowBox.x + toolbarRowBox.width - 24,
    );
  });

  test("代码块语言切换在顶部工具栏仍可用", async ({ page }) => {
    await openWorkspace(page);
    await createFreshPage(page);
    await setCodeBlockContent(page, "javascript", "console.log('hello')");

    const codeBlock = page.locator(".ProseMirror .code-block-node").first();
    await codeBlock.hover();

    const languageTrigger = page
      .locator(".ProseMirror .code-block-toolbar-row button")
      .filter({ hasText: "JavaScript" })
      .first();
    await expect(languageTrigger).toBeVisible();
    await languageTrigger.click();

    const searchInput = page.getByPlaceholder("搜索语言...");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("python");
    await page.locator('[role="menuitem"]').filter({ hasText: "Python" }).first().click();

    const currentLanguage = await getFirstCodeBlockLanguage(page);
    expect(currentLanguage).toBe("python");
  });

  test("代码块左上角支持标题编辑并写入属性", async ({ page }) => {
    await openWorkspace(page);
    await createFreshPage(page);
    await setCodeBlockContent(page, "javascript", "console.log('hello')");

    const editor = page.locator(".ProseMirror").first();
    const codeBlock = editor.locator(".code-block-node").first();
    const summaryInput = codeBlock.getByPlaceholder("添加代码说明").first();
    await expect(summaryInput).toBeVisible();
    await expect(summaryInput).toHaveValue("");
    await summaryInput.click();
    await summaryInput.fill("初始化脚本");
    await summaryInput.press("Enter");

    await expect(summaryInput).toHaveValue("初始化脚本");
    const attrs = await getFirstCodeBlockAttrs(page);
    expect(attrs.summary).toBe("初始化脚本");
  });

  test("代码块折叠后仅保留顶部标题行", async ({ page }) => {
    await openWorkspace(page);
    await createFreshPage(page);
    await setCodeBlockContent(page, "javascript", "console.log('hello')");

    const codeBlock = page.locator(".ProseMirror .code-block-node").first();
    const collapseToggle = codeBlock.locator(".code-block-collapse-toggle").first();

    await expect(codeBlock.locator(".code-block-content")).toBeVisible();
    await collapseToggle.click();

    await expect(codeBlock).toHaveClass(/is-collapsed/);
    await expect(codeBlock.locator(".code-block-toolbar-row")).toBeVisible();
    await expect(codeBlock.locator(".code-block-summary-input")).toBeVisible();
    await expect(codeBlock.locator(".code-block-content")).toHaveCount(0);

    const attrsAfterCollapse = await getFirstCodeBlockAttrs(page);
    expect(attrsAfterCollapse.collapsed).toBe(true);

    await collapseToggle.click();
    await expect(codeBlock).not.toHaveClass(/is-collapsed/);
    await expect(codeBlock.locator(".code-block-content")).toBeVisible();

    const attrsAfterExpand = await getFirstCodeBlockAttrs(page);
    expect(attrsAfterExpand.collapsed).toBe(false);
  });

  test("代码块工具栏按钮无边框且通过背景色反馈状态", async ({ page }) => {
    await openWorkspace(page);
    await createFreshPage(page);
    await setCodeBlockContent(page, "javascript", "const a = 1");

    const editor = page.locator(".ProseMirror").first();
    const codeBlock = editor.locator(".code-block-node").first();
    await codeBlock.hover();
    const languageTrigger = page
      .locator(".code-block-node .code-block-toolbar-row button")
      .filter({ hasText: "JavaScript" })
      .first();
    await expect(languageTrigger).toBeVisible();

    const defaultStyles = await languageTrigger.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        borderWidth: style.borderWidth,
        backgroundColor: style.backgroundColor,
      };
    });
    expect(defaultStyles.borderWidth).toBe("0px");

    await languageTrigger.click();
    await expect(languageTrigger).toHaveClass(/code-toolbar-chip-active/);
    await expect(page.getByPlaceholder("搜索语言...")).toBeVisible();

    await page.keyboard.press("Escape");
    const wrapToggle = codeBlock.locator(".code-toolbar-wrap-toggle").first();
    await expect(wrapToggle).toBeVisible();
    await expect(codeBlock.locator(".line-numbers")).toBeVisible();
    await wrapToggle.click();
    await expect(wrapToggle).toHaveClass(/code-toolbar-chip-active/);
    await expect(codeBlock.locator("pre .hljs").first()).toHaveCSS(
      "white-space",
      "pre-wrap",
    );
    await expect(codeBlock.locator(".line-numbers")).toHaveCount(0);
  });

  test("Markdown 导出与导入支持代码块摘要与折叠状态", async ({ page }) => {
    await openWorkspace(page);

    const roundtrip = await page.evaluate(async () => {
      const mod = await import("/src/lib/export.ts");
      const doc = {
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: {
              language: "javascript",
              summary: "初始化脚本",
              collapsed: true,
            },
            content: [{ type: "text", text: "const answer = 42;" }],
          },
        ],
      };

      const markdown = mod.jsonContentToMarkdown(doc as any);
      const imported = mod.importFromMarkdown(markdown);
      const importedNodes = imported.content.content || [];
      const firstCodeBlock = importedNodes.find(
        (node: any) => node.type === "codeBlock",
      );
      const plainDoc = {
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: { language: "javascript" },
            content: [{ type: "text", text: "const answer = 42;" }],
          },
        ],
      };
      const plainMarkdown = mod.jsonContentToMarkdown(plainDoc as any);
      const legacyImported = mod.importFromMarkdown(
        '<!-- goose-note:codeblock {"note":"旧备注"} -->\n```javascript\nconst answer = 42;\n```',
      );
      const legacyNodes = legacyImported.content.content || [];
      const hasLegacyCommentParagraph = legacyNodes.some(
        (node: any) =>
          node.type === "paragraph" &&
          JSON.stringify(node.content || []).includes("goose-note:codeblock"),
      );

      return {
        markdown,
        plainMarkdown,
        restoredLanguage: firstCodeBlock?.attrs?.language || "",
        restoredSummary: firstCodeBlock?.attrs?.summary || "",
        restoredCollapsed: firstCodeBlock?.attrs?.collapsed === true,
        hasLegacyCommentParagraph,
      };
    });

    expect(roundtrip.markdown).toContain("goose-note=");
    expect(roundtrip.plainMarkdown).not.toContain("goose-note=");
    expect(roundtrip.restoredLanguage).toBe("javascript");
    expect(roundtrip.restoredSummary).toBe("初始化脚本");
    expect(roundtrip.restoredCollapsed).toBe(true);
    expect(roundtrip.hasLegacyCommentParagraph).toBe(false);
  });
});
