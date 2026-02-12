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

test.describe("编辑器 P0 冒烟", () => {
  test("输入与保存流程可执行", async ({ page }) => {
    await openWorkspace(page);
    await createFreshPage(page);
    const bodyText = `回归测试文本-A-${Date.now()}`;
    await focusEditorParagraph(page);
    await page.keyboard.type(bodyText);
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
});
