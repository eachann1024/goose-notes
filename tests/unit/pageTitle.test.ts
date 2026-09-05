import { expect, test } from "playwright/test";
import type { Page } from "../../src/types";
import {
  extractBlockNoteTitle,
  extractPlainText,
  normalizePageContent,
  type PageContent,
} from "../../src/components/editor/utils/blocknote-content";
import {
  getPageTitle,
  UNTITLED_PAGE_TITLE,
  withInternalPageTitle,
} from "../../src/components/editor/utils/page-title";

const pageBase: Omit<Page, "content"> = {
  id: "page-1",
  workspaceId: "notebook-1",
  isFolder: false,
  isLocked: false,
  fontSize: "default",
  fontFamily: "default",
  createdAt: 1,
  updatedAt: 1,
  order: 1,
};

test("空的内部页和本地文件名统一显示为未命名", () => {
  expect(
    getPageTitle({
      ...pageBase,
      content: [
        { type: "heading", props: { level: 1 }, content: "" },
        { type: "paragraph", content: "正文" },
      ],
    }),
  ).toBe(UNTITLED_PAGE_TITLE);

  expect(
    getPageTitle({
      ...pageBase,
      content: [],
      localFilePath: "/notes/.md",
    }),
  ).toBe(UNTITLED_PAGE_TITLE);
});

test("正文旧快照合并顶栏最新标题且不修改传入内容", () => {
  const editorSnapshot = [
    { type: "heading", props: { level: 1 }, content: "旧标题" },
    { type: "paragraph", content: "新正文" },
  ];
  const merged = withInternalPageTitle(editorSnapshot, "新标题") as any[];

  expect(merged[0]?.content).toBe("新标题");
  expect(merged[1]?.content).toBe("新正文");
  expect(editorSnapshot[0]?.content).toBe("旧标题");
});

test("空顶栏名称持久化为未命名", () => {
  const merged = withInternalPageTitle(
    [{ type: "paragraph", content: "正文" }],
    "   ",
  ) as any[];

  expect(merged[0]).toMatchObject({
    type: "heading",
    props: { level: 1 },
    content: UNTITLED_PAGE_TITLE,
  });
  expect(merged[1]?.content).toBe("正文");
});

test("extractBlockNoteTitle 与完整 normalize 的标题语义一致", () => {
  const cases: Array<[unknown, string]> = [
    [[{ type: "heading", content: "  标题  " }], "标题"],
    [[{ type: "heading", content: "标题", children: {} }], "无标题"],
    [[{ type: "heading", content: "标题", children: false }], "无标题"],
    [[{ type: "heading", content: "标题", children: 0 }], "无标题"],
    [[{ type: "heading", content: "标题", children: "" }], "无标题"],
    [[{ type: "heading", content: "标题", children: null }], "标题"],
    [[{ type: "heading", content: "标题", children: undefined }], "标题"],
    [[{
      type: "heading",
      props: { level: 2, collapsed: true },
      content: [
        "裸字符串 ",
        { type: "text", text: "加粗 ", styles: { bold: true } },
        { type: "link", content: [{ type: "text", text: "链接" }] },
        { type: "pageMention", props: { title: " 页面 " } },
      ],
      children: [{ type: "paragraph", content: "不计入标题" }],
    }], "裸字符串 加粗 链接@页面"],
    [[{ type: "heading", content: " ", children: [] }], "无标题"],
    [[{ type: "heading", content: [], text: "不应读取" }], "无标题"],
    [[{ type: "heading", content: null, text: "不应读取" }], "无标题"],
    [[{
      type: "heading",
      content: " ",
      props: { caption: "包装块属性不应成为标题" },
      children: [{ type: "paragraph", content: "子块成为标题" }],
    }], "子块成为标题"],
    [[{
      type: "heading",
      content: [{ type: "pageMention", props: { title: " " } }],
      children: [{ type: "heading", content: "子标题" }],
    }], "子标题"],
    [[{
      type: "heading",
      content: [{ type: "paragraph", content: "结构化内容" }],
    }], "结构化内容"],
    [[{
      type: "heading",
      attrs: { caption: "旧属性" },
      content: "旧标题",
    }], "旧标题 旧属性"],
    [[{
      type: "heading",
      props: { caption: "说明", language: "yaml-frontmatter" },
      content: "---\ngoose-theme: dark\nname: 笔记\n---",
    }], "name: 笔记 说明"],
    [{
      type: "doc",
      content: [{ type: "heading", attrs: { level: 1 }, content: ["旧格式"] }],
    }, "旧格式"],
    [[{ type: "paragraph", content: "首段提升" }], "首段提升"],
    [[{ type: "image", props: { url: "image.png" } }], "无标题"],
    [[], "无标题"],
    [null, "无标题"],
    [undefined, "无标题"],
    [{ foo: 1 }, "无标题"],
  ];

  for (const [value, expected] of cases) {
    const content = value as PageContent | undefined;
    const first = normalizePageContent(content)[0];
    const normalizedTitle = first?.type === "heading"
      ? extractPlainText([first]) || "无标题"
      : "无标题";
    expect(normalizedTitle).toBe(expected);
    expect(extractBlockNoteTitle(content)).toBe(normalizedTitle);
  }
});

test("extractBlockNoteTitle 不将异常首标题形状视为普通标题", () => {
  for (const heading of [
    Object.assign(() => {}, { type: "heading", content: "标题" }),
    Object.assign([], { type: "heading", content: "标题" }),
    { type: "heading", content: "标题", props: "非法属性" },
    { type: "heading", content: "标题", props: [] },
  ]) {
    const content = [heading, { type: "paragraph", children: {} }] as unknown as PageContent;
    expect(extractPlainText(normalizePageContent(content))).toBe("");
    expect(extractBlockNoteTitle(content)).toBe("无标题");
  }
});

test("extractBlockNoteTitle 有效首标题不因损坏的后续正文回退", () => {
  const content = [
    { type: "heading", content: "标题" },
    { type: "paragraph", children: {} },
  ] as unknown as PageContent;

  expect(extractPlainText(normalizePageContent(content))).toBe("");
  expect(extractBlockNoteTitle(content)).toBe("标题");
});

test("extractBlockNoteTitle 普通首标题不访问后续正文或 children 内容", () => {
  for (const title of ["标题", " "]) {
    let bodyReads = 0;
    const body = {
      type: "paragraph",
      get content(): string {
        bodyReads += 1;
        throw new Error("不应读取正文");
      },
    };
    const content = [{
      type: "heading",
      content: title,
      children: title.trim() ? [body] : [],
    }] as PageContent;
    Object.defineProperty(content, "1", {
      get() {
        bodyReads += 1;
        throw new Error("不应访问后续块");
      },
    });

    expect(extractBlockNoteTitle(content)).toBe(title.trim() || "无标题");
    expect(bodyReads).toBe(0);
  }
});

test("坏 content 不抛并回退未命名", () => {
  expect(
    getPageTitle({
      ...pageBase,
      content: undefined as unknown as Page["content"],
    }),
  ).toBe(UNTITLED_PAGE_TITLE);

  expect(() =>
    getPageTitle({
      ...pageBase,
      content: { foo: 1 } as unknown as Page["content"],
    }),
  ).not.toThrow();
  expect(
    getPageTitle({
      ...pageBase,
      content: { foo: 1 } as unknown as Page["content"],
    }),
  ).toBe(UNTITLED_PAGE_TITLE);

  expect(() => getPageTitle(null as unknown as Page)).not.toThrow();
  expect(getPageTitle(null as unknown as Page)).toBe(UNTITLED_PAGE_TITLE);
});
