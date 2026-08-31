import { expect, test } from "playwright/test";
import { cloneExportBlocks } from "../../src/lib/export/prepareExportBlocks";

test("把本地文件夹的 doc 对象收成可迭代块数组", () => {
  const blocks = cloneExportBlocks(
    {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "本地笔记" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "正文" }],
        },
      ],
    } as any,
    { ensureFirstTitle: false },
  );
  expect(Array.isArray(blocks)).toBeTruthy();
  expect(blocks.length).toBeGreaterThan(0);
  for (const block of blocks) {
    expect(Array.isArray((block as { children?: unknown }).children)).toBeTruthy();
    if ((block as { type?: string }).type !== "table") {
      expect(Array.isArray((block as { content?: unknown }).content)).toBeTruthy();
    }
  }
});

test("图片 / 分割线等无 inline content 的块不会留下 undefined", () => {
  const blocks = cloneExportBlocks(
    [
      { type: "paragraph", content: undefined },
      { type: "image", props: { url: "./assets/a.png" } },
      { type: "heading", content: "纯字符串标题" },
    ] as any,
    { ensureFirstTitle: false },
  );
  expect(Array.isArray(blocks[0].content)).toBeTruthy();
  expect(Array.isArray((blocks[1] as { content?: unknown }).content)).toBeTruthy();
  expect(Array.isArray((blocks[2] as { content?: unknown }).content)).toBeTruthy();
  expect(((blocks[2] as { content: Array<{ text?: string }> }).content[0] as any).text).toBe(
    "纯字符串标题",
  );
});

test("本地文件夹不强制插入首块 H1", () => {
  const blocks = cloneExportBlocks(
    [{ type: "paragraph", content: [{ type: "text", text: "没有标题" }] }] as any,
    { ensureFirstTitle: false },
  );
  expect(blocks[0].type).toBe("paragraph");
});

test("导出前拍平 heading.children，不把下一节塞进上一节", () => {
  const blocks = cloneExportBlocks(
    [
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "旧系统体系", styles: {} }],
        children: [
          {
            type: "bulletListItem",
            content: [{ type: "text", text: "列表", styles: {} }],
          },
          {
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "AI Agent", styles: {} }],
            children: [
              {
                type: "bulletListItem",
                content: [{ type: "text", text: "定时任务", styles: {} }],
              },
            ],
          },
        ],
      },
    ] as any,
    { ensureFirstTitle: false },
  );
  expect(blocks.map((block) => block.type)).toEqual([
    "heading",
    "bulletListItem",
    "heading",
    "bulletListItem",
  ]);
  expect((blocks[0] as { children?: unknown[] }).children).toEqual([]);
  expect((blocks[2] as { content: Array<{ text?: string }> }).content[0]?.text).toBe(
    "AI Agent",
  );
});
