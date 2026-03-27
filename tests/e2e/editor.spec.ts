import { expect, test } from "playwright/test";
import { bootApp, createPageFromSidebar, writeNote } from "./helpers";

async function setEditorTable(page: import("playwright/test").Page) {
  await page.evaluate(() => {
    const editor = (window as { __gooseNoteEditor?: any }).__gooseNoteEditor;
    const fillerParagraphs = Array.from({ length: 18 }, (_, index) => ({
      type: "paragraph",
      content: [{ type: "text", text: `顶部占位 ${index + 1} 这是用于制造滚动距离的回归测试文本` }],
    }));
    const bottomParagraphs = Array.from({ length: 12 }, (_, index) => ({
      type: "paragraph",
      content: [{ type: "text", text: `底部占位 ${index + 1}` }],
    }));

    editor?.commands?.setContent?.(
      {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "表格对齐校验" }],
          },
          ...fillerParagraphs,
          {
            type: "table",
            attrs: { tableAlignment: "center", tableWidthMode: "content" },
            content: [
              {
                type: "tableRow",
                content: [
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "很长的表头内容一" }] }] },
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "很长的表头内容二" }] }] },
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "很长的表头内容三" }] }] },
                ],
              },
              {
                type: "tableRow",
                content: [
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "很长的单元格内容一一一一一" }] }] },
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "很长的单元格内容二二二二二" }] }] },
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "很长的单元格内容三三三三三" }] }] },
                ],
              },
            ],
          },
          ...bottomParagraphs,
        ],
      },
      true,
    );
  });
}

async function setTableAlignment(page: import("playwright/test").Page, alignment: "left" | "center" | "right") {
  await page.evaluate((nextAlignment) => {
    const editor = (window as { __gooseNoteEditor?: any }).__gooseNoteEditor;
    const { state, view } = editor ?? {};
    if (!state || !view) return;

    let tablePos: number | null = null;
    state.doc.descendants((node: any, pos: number) => {
      if (tablePos != null) return false;
      if (node.type.name === "table") {
        tablePos = pos;
        return false;
      }
      return true;
    });

    if (tablePos == null) return;

    editor
      .chain()
      .command(({ tr, state: innerState, dispatch }: any) => {
        const node = innerState.doc.nodeAt(tablePos);
        if (!node) return false;
        if (dispatch) {
          tr.setNodeMarkup(tablePos, undefined, {
            ...node.attrs,
            tableAlignment: nextAlignment,
          });
        }
        return true;
      })
      .run();
  }, alignment);
}

async function getTableAlignmentSnapshot(page: import("playwright/test").Page) {
  return page.locator(".ProseMirror .tableWrapper").evaluate((wrapper) => {
    const table = wrapper.querySelector("table");
    const wrapperStyle = window.getComputedStyle(wrapper as HTMLElement);
    const tableStyle = table ? window.getComputedStyle(table as HTMLElement) : null;
    const editor = (window as { __gooseNoteEditor?: any }).__gooseNoteEditor;
    let tableAlignment: string | null = null;

    editor?.state?.doc?.descendants((node: any) => {
      if (tableAlignment != null) return false;
      if (node.type.name === "table") {
        tableAlignment = node.attrs?.tableAlignment ?? null;
        return false;
      }
      return true;
    });

    return {
      wrapperAlign: wrapperStyle.textAlign,
      marginLeft: tableStyle?.marginLeft,
      marginRight: tableStyle?.marginRight,
      tableAlignment,
    };
  });
}

async function insertDefaultTable(page: import("playwright/test").Page) {
  await page.evaluate(() => {
    const editor = (window as { __gooseNoteEditor?: any }).__gooseNoteEditor;
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  });
}

async function prepareSlashParagraph(page: import("playwright/test").Page) {
  await page.evaluate(() => {
    const editor = (window as { __gooseNoteEditor?: any }).__gooseNoteEditor;
    if (!editor) return;

    editor.commands.setContent(
      {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "无标题" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "/" }],
          },
        ],
      },
      true,
    );

    let slashPos: number | null = null;
    editor.state.doc.descendants((node: any, pos: number) => {
      if (slashPos != null) return false;
      if (node.isText && node.text === "/") {
        slashPos = pos;
        return false;
      }
      return true;
    });

    if (slashPos != null) {
      editor.chain().focus().setTextSelection(slashPos + 1).run();
    }
  });
}

async function getLastParagraphText(page: import("playwright/test").Page) {
  return page.evaluate(() => {
    const paragraphs = Array.from(document.querySelectorAll(".ProseMirror > p"));
    const lastParagraph = paragraphs[paragraphs.length - 1] as HTMLElement | undefined;
    return lastParagraph?.innerText.trim() ?? "";
  });
}

test.describe("编辑流程", () => {
  test("编辑标题后侧边栏与标签同步更新", async ({ page }) => {
    const title = `E2E 标题同步 ${Date.now()}`;

    await bootApp(page);
    await createPageFromSidebar(page);
    await writeNote(page, title, "标题同步正文");

    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.locator(`[title="${title}"]`)).toBeVisible();
    await expect(
      page.getByRole("button", { name: `展开子页面 ${title}` }),
    ).toBeVisible();
  });

  test("编辑正文后刷新仍能保留内容", async ({ page }) => {
    const title = `E2E 持久化 ${Date.now()}`;
    const body = `正文持久化校验 ${Date.now()}`;

    await bootApp(page);
    await createPageFromSidebar(page);
    await writeNote(page, title, body);

    await page.reload();
    await page.getByRole("button", { name: `展开子页面 ${title}` }).click();

    await expect(page.locator(".ProseMirror").first()).toContainText(title);
    await expect(page.locator(".ProseMirror").first()).toContainText(body);
  });

  test("输入斜杠后退格可删除斜杠字符", async ({ page }) => {
    await bootApp(page);
    await createPageFromSidebar(page);
    await prepareSlashParagraph(page);
    await expect.poll(() => getLastParagraphText(page)).toBe("/");

    await page.keyboard.press("Backspace");
    await expect.poll(() => getLastParagraphText(page)).toBe("");
  });

  test("输入斜杠后可继续输入筛选文本", async ({ page }) => {
    await bootApp(page);
    await createPageFromSidebar(page);
    await prepareSlashParagraph(page);
    await expect.poll(() => getLastParagraphText(page)).toBe("/");

    await page.keyboard.type("he");
    await expect.poll(() => getLastParagraphText(page)).toBe("/he");
  });

  test("标题后正文段首退格不会并入标题", async ({ page }) => {
    const title = `E2E 标题退格 ${Date.now()}`;
    const body = `正文保持段落 ${Date.now()}`;

    await bootApp(page);
    await createPageFromSidebar(page);
    await writeNote(page, title, body);

    await page.evaluate(() => {
      const editor = (
        window as {
          __gooseNoteEditor?: {
            state?: {
              doc?: {
                firstChild?: {
                  nodeSize?: number;
                };
              };
            };
            commands?: {
              setTextSelection?: (position: number) => void;
              focus?: () => void;
            };
          };
        }
      ).__gooseNoteEditor;

      const titleNodeSize = editor?.state?.doc?.firstChild?.nodeSize ?? 0;
      editor?.commands?.setTextSelection?.(titleNodeSize + 1);
      editor?.commands?.focus?.();
    });
    await page.keyboard.press("Backspace");

    await expect(page.locator(".ProseMirror > h1")).toHaveText(title);
    await expect(page.locator(".ProseMirror > p").first()).toHaveText(body);
  });

  test("表格对齐始终保持居左", async ({ page }) => {
    await bootApp(page);
    await createPageFromSidebar(page);
    await setEditorTable(page);

    await expect(page.locator(".ProseMirror .tableWrapper")).toBeVisible();

    await setTableAlignment(page, "left");
    await expect.poll(() => getTableAlignmentSnapshot(page)).toMatchObject({
      tableAlignment: "left",
      wrapperAlign: "left",
    });

    await setTableAlignment(page, "center");
    await expect.poll(() => getTableAlignmentSnapshot(page)).toMatchObject({
      tableAlignment: "center",
      wrapperAlign: "left",
    });

    await setTableAlignment(page, "right");
    await expect.poll(() => getTableAlignmentSnapshot(page)).toMatchObject({
      tableAlignment: "right",
      wrapperAlign: "left",
    });
  });

  test("新建表格默认左对齐且为适应宽度", async ({ page }) => {
    await bootApp(page);
    await createPageFromSidebar(page);
    await insertDefaultTable(page);

    await expect(page.locator(".ProseMirror .tableWrapper")).toBeVisible();
    await expect.poll(() => getTableAlignmentSnapshot(page)).toMatchObject({
      tableAlignment: "left",
      wrapperAlign: "left",
    });
    await expect.poll(() =>
      page.locator(".ProseMirror .tableWrapper table").evaluate((table) => ({
        widthMode: table.getAttribute("data-table-width-mode"),
        width: window.getComputedStyle(table as HTMLElement).width,
      })),
    ).toMatchObject({
      widthMode: "full",
    });
  });

  test("折叠标题后拖拽手柄保持在当前标题旁", async ({ page }) => {
    await bootApp(page);
    await createPageFromSidebar(page);

    const positions = await page.evaluate(async () => {
      const editor = (window as { __gooseNoteEditor?: any }).__gooseNoteEditor;
      if (!editor) return null;

      editor.commands.setContent(
        {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: "AI 功能介绍与展示" }],
            },
            {
              type: "heading",
              attrs: { level: 2, collapsed: false },
              content: [{ type: "text", text: "面试场景：" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "你好刚才面试完了，大概啥时候有反馈" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "我对小红书运营有些经验，但是这个行业我没做过" }],
            },
            {
              type: "heading",
              attrs: { level: 2, collapsed: false },
              content: [{ type: "text", text: "文章生成" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "生成一篇关于新能源汽车固态电池的小红书科普文章" }],
            },
          ],
        },
        true,
      );
      editor.commands.focus("end");
      await new Promise((resolve) => window.setTimeout(resolve, 50));

      const editorShell = document.querySelector(".ProseMirror")?.parentElement;
      const heading = Array.from(document.querySelectorAll(".ProseMirror > h2")).find(
        (element) => element.textContent?.includes("文章生成"),
      );
      const indicator = Array.from(document.querySelectorAll(".heading-collapse-indicator")).find(
        (element) => element.parentElement?.textContent?.includes("文章生成"),
      );
      const handle = document.querySelector(".drag-handle");

      if (!editorShell || !heading || !indicator || !handle) {
        return null;
      }

      const headingRect = heading.getBoundingClientRect();
      editorShell.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          clientX: headingRect.left + 2,
          clientY: headingRect.top + headingRect.height / 2,
        }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 50));

      const beforeRect = handle.getBoundingClientRect();
      const indicatorRect = indicator.getBoundingClientRect();
      indicator.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: indicatorRect.left + 5,
          clientY: indicatorRect.top + 5,
        }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 80));

      const afterRect = handle.getBoundingClientRect();
      return {
        beforeTop: beforeRect.top,
        afterTop: afterRect.top,
      };
    });

    expect(positions).not.toBeNull();
    expect(Math.abs(positions!.afterTop - positions!.beforeTop)).toBeLessThan(20);
  });
});
