import { expect, test } from "playwright/test";
import {
  extractPlainText,
  simpleExtractText,
} from "../../src/components/editor/utils/blocknote-content";
import {
  resetIndex,
  searchIndex,
  syncIndex,
} from "../../src/pages/workspace/components/command/pageSearchIndex";
import type { Page } from "../../src/types";

const text = (value: string) => ({ type: "text", text: value, styles: {} });

function pageWithContent(id: string, content: unknown[]): Page {
  return {
    id,
    workspaceId: "notebook-1",
    content: content as Page["content"],
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    createdAt: 1,
    updatedAt: 1,
  };
}

test("extractPlainText 能抽出 InlineContent 数组形态的表格单元格", () => {
  const content = [
    { type: "heading", props: { level: 1 }, content: "页面标题" },
    {
      type: "table",
      content: {
        type: "tableContent",
        rows: [
          {
            cells: [[text("供应商")], [text("金额")]],
          },
          {
            cells: [[text("鹅厂")], [text("1280")]],
          },
        ],
      },
    },
  ];

  const plain = extractPlainText(content);
  expect(plain).toContain("供应商");
  expect(plain).toContain("鹅厂");
  expect(plain).toContain("1280");
});

test("extractPlainText 能抽出 tableCell 对象与单元格内嵌段落", () => {
  const content = [
    {
      type: "table",
      content: {
        type: "tableContent",
        rows: [
          {
            cells: [
              { type: "tableCell", content: [text("表头A")] },
              {
                type: "tableCell",
                content: [
                  { type: "paragraph", content: [text("单元格正文")] },
                ],
              },
            ],
          },
        ],
      },
    },
  ];

  const plain = extractPlainText(content);
  expect(plain).toContain("表头A");
  expect(plain).toContain("单元格正文");
});

test("extractPlainText 能抽出字符串单元格和单元格内链接文字", () => {
  const content = [
    {
      type: "table",
      content: {
        type: "tableContent",
        rows: [
          { cells: ["章节", "说明"] },
          {
            cells: [
              [text("搜索")],
              [
                {
                  type: "link",
                  href: "https://example.com",
                  content: [text("找内容")],
                },
              ],
            ],
          },
        ],
      },
    },
  ];

  const plain = extractPlainText(content);
  expect(plain).toContain("章节");
  expect(plain).toContain("说明");
  expect(plain).toContain("搜索");
  expect(plain).toContain("找内容");
  expect(plain).not.toContain("https://example.com");
});

test("simpleExtractText 对表格块也能抽出单元格文字", () => {
  const table = {
    type: "table",
    content: {
      type: "tableContent",
      rows: [{ cells: [[text("库存")], [text("42")]] }],
    },
  };

  expect(simpleExtractText(table)).toContain("库存");
  expect(simpleExtractText(table)).toContain("42");
});

test("extractPlainText 能抽出图片说明与文件名", () => {
  const content = [
    {
      type: "image",
      props: { url: "att:img-1", caption: "年度团建合影", name: "team-2026.jpg" },
    },
    {
      type: "imageResize",
      attrs: { src: "old.png", alt: "旧版封面" },
    },
  ];

  const plain = extractPlainText(content);
  expect(plain).toContain("年度团建合影");
  expect(plain).toContain("team-2026.jpg");
  expect(plain).toContain("旧版封面");
  expect(plain).not.toContain("att:img-1");
});

test("extractPlainText 能抽出文件、视频、音频的名称和说明", () => {
  const content = [
    {
      type: "file",
      props: { url: "att-file:doc-1", name: "季度报表.pdf", caption: "财务附件" },
    },
    {
      type: "video",
      props: { url: "att-video:v-1", name: "产品演示.mp4", caption: "发布会录像" },
    },
    {
      type: "audio",
      props: { url: "att:audio-1", name: "访谈录音.m4a" },
    },
  ];

  const plain = extractPlainText(content);
  expect(plain).toContain("季度报表.pdf");
  expect(plain).toContain("财务附件");
  expect(plain).toContain("产品演示.mp4");
  expect(plain).toContain("发布会录像");
  expect(plain).toContain("访谈录音.m4a");
});

test("extractPlainText 能抽出代码块正文和折叠摘要", () => {
  const content = [
    {
      type: "codeBlock",
      props: { language: "typescript", summary: "登录校验" },
      content: "export function canSignIn() { return true; }",
    },
  ];

  const plain = extractPlainText(content);
  expect(plain).toContain("canSignIn");
  expect(plain).toContain("登录校验");
});

test("extractPlainText 仍能抽出标注、引用、公式和 mermaid 正文", () => {
  const content = [
    { type: "callout", content: [text("注意备份数据库")] },
    { type: "quote", content: [text("前人栽树")] },
    {
      type: "codeBlock",
      props: { language: "math" },
      content: [text("E = mc^2")],
    },
    {
      type: "codeBlock",
      props: { language: "mermaid" },
      content: [text("flowchart TD\n  A[开始] --> B[结束]")],
    },
  ];

  const plain = extractPlainText(content);
  expect(plain).toContain("注意备份数据库");
  expect(plain).toContain("前人栽树");
  expect(plain).toContain("E = mc^2");
  expect(plain).toContain("开始");
});

test("占位文件名、存储引用和链接地址不进入搜索文本", () => {
  const content = [
    {
      type: "image",
      props: { url: "att:img-1", name: "image.webp", caption: "团建照片" },
    },
    {
      type: "video",
      props: { url: "att-video:v-1", name: "video.mp4" },
    },
    {
      type: "file",
      props: { url: "att-file:doc-1", name: "att-file:secret" },
    },
    {
      type: "paragraph",
      content: [
        {
          type: "link",
          href: "https://example.com/path",
          content: [text("官网")],
        },
      ],
    },
  ];

  const plain = extractPlainText(content);
  expect(plain).toContain("团建照片");
  expect(plain).toContain("官网");
  expect(plain).not.toContain("image.webp");
  expect(plain).not.toContain("video.mp4");
  expect(plain).not.toContain("att-file:secret");
  expect(plain).not.toContain("https://example.com");
});

test("yaml-frontmatter 的 goose 设置不进入搜索，用户字段保留", () => {
  const content = [
    {
      type: "codeBlock",
      props: { language: "yaml-frontmatter" },
      content:
        "---\ngoose-font: serif\ngoose-locked: true\nname: pearl\ndescription: 覆盖 PR 全链路\n---",
    },
  ];

  const plain = extractPlainText(content);
  expect(plain).toContain("pearl");
  expect(plain).toContain("覆盖 PR 全链路");
  expect(plain).not.toContain("goose-font");
  expect(plain).not.toContain("serif");
  expect(plain).not.toContain("goose-locked");
});

test("占位标题不会让未命名空页被搜出来", () => {
  resetIndex();
  try {
    syncIndex({
      "page-untitled": pageWithContent("page-untitled", [
        { type: "heading", props: { level: 1 }, content: "未命名" },
        { type: "paragraph", content: "" },
      ]),
      "page-named": pageWithContent("page-named", [
        { type: "heading", props: { level: 1 }, content: "采购说明" },
        { type: "paragraph", content: "未命名流程不要用" },
      ]),
    });

    expect(searchIndex("未命名")).not.toContain("page-untitled");
    expect(searchIndex("未命名")).toContain("page-named");
  } finally {
    resetIndex();
  }
});

test("全局搜索索引能命中附件文件名", () => {
  resetIndex();
  try {
    syncIndex({
      "page-file": pageWithContent("page-file", [
        { type: "heading", props: { level: 1 }, content: "资料" },
        {
          type: "file",
          props: { url: "att-file:doc-2", name: "合同扫描件.pdf" },
        },
      ]),
    });

    expect(searchIndex("合同扫描件")).toContain("page-file");
  } finally {
    resetIndex();
  }
});

test("全局搜索索引能命中表格单元格内容", () => {
  resetIndex();
  try {
    syncIndex({
      "page-table": pageWithContent("page-table", [
        { type: "heading", props: { level: 1 }, content: "采购单" },
        {
          type: "table",
          content: {
            type: "tableContent",
            rows: [
              { cells: [[text("物料")], [text("数量")]] },
              { cells: [[text("键盘轴体")], [text("200")]] },
            ],
          },
        },
      ]),
    });

    expect(searchIndex("键盘轴体")).toContain("page-table");
    expect(searchIndex("200")).toContain("page-table");
  } finally {
    resetIndex();
  }
});
