import { expect, test } from "playwright/test";
import {
  pageMentionFromMarkdownLink,
  pageMentionFromWikiLink,
  pageMentionLabel,
  parsePageMentionHref,
  sanitizePageMentionProps,
  serializePageMentionHref,
  serializePageMentionMarkdown,
  wikiTargetFromReference,
} from "../../src/components/editor/inline/pageMention";
import { parseInlineMarkdown } from "../../src/lib/export/markdown/parse/inline";
import { jsonContentToMarkdown } from "../../src/lib/export/markdown/serialize";
import { resolvePageMentionNavigation } from "../../src/lib/pageMentionNavigation";
import { createEditorSafeContent } from "../../src/components/editor/utils/blocknote-content/editorSafeContent";
import { simpleExtractText } from "../../src/components/editor/utils/blocknote-content/normalize";
import type { Page } from "../../src/types";

const mention = {
  pageId: "page-42",
  workspaceId: "nb-1",
  title: "周报",
  notebookName: "工作",
  wikiTarget: "",
};

test("pageMention href 往返保留 pageId 与笔记本", () => {
  const href = serializePageMentionHref(mention);
  expect(href.startsWith("goose-page://")).toBe(true);
  expect(parsePageMentionHref(href)).toEqual({
    pageId: "page-42",
    workspaceId: "nb-1",
  });
});

test("pageMention href 能解析本地文件夹 id", () => {
  const local = {
    ...mention,
    pageId: "local-nb-notes%2Fhello.md",
  };
  expect(parsePageMentionHref(serializePageMentionHref(local))).toEqual({
    pageId: "local-nb-notes%2Fhello.md",
    workspaceId: "nb-1",
  });
});

test("pageMention markdown 往返", () => {
  const markdown = serializePageMentionMarkdown(mention);
  expect(markdown).toBe("[@周报](goose-page://page-42?nb=nb-1)");
  expect(pageMentionFromMarkdownLink("@周报", serializePageMentionHref(mention))).toEqual({
    pageId: "page-42",
    workspaceId: "nb-1",
    title: "周报",
    notebookName: "",
    wikiTarget: "",
  });
  expect(parseInlineMarkdown(`见 ${markdown} 结尾`)).toEqual([
    "见 ",
    {
      type: "pageMention",
      props: {
        pageId: "page-42",
        workspaceId: "nb-1",
        title: "周报",
        notebookName: "",
        wikiTarget: "",
      },
    },
    " 结尾",
  ]);
});

test("有 wikiTarget 的提及写成 Obsidian 双链", () => {
  expect(
    serializePageMentionMarkdown({
      ...mention,
      wikiTarget: "notes/周报",
    }),
  ).toBe("[[notes/周报]]");
  expect(
    serializePageMentionMarkdown({
      ...mention,
      title: "本周",
      wikiTarget: "notes/周报",
    }),
  ).toBe("[[notes/周报|本周]]");
  expect(
    serializePageMentionMarkdown({
      ...mention,
      wikiTarget: "周报",
    }),
  ).toBe("[[周报]]");
});

test("jsonContentToMarkdown 把 pageMention 写成 goose-page 链接", () => {
  const markdown = jsonContentToMarkdown([
    {
      id: "p1",
      type: "paragraph",
      props: {},
      content: [
        { type: "text", text: "见 ", styles: {} },
        { type: "pageMention", props: mention },
      ],
    },
  ] as never);
  expect(markdown).toContain("[@周报](goose-page://page-42?nb=nb-1)");
});

test("jsonContentToMarkdown 把 wikiTarget 写成双链", () => {
  const markdown = jsonContentToMarkdown([
    {
      id: "p1",
      type: "paragraph",
      props: {},
      content: [
        {
          type: "pageMention",
          props: { ...mention, wikiTarget: "周报" },
        },
      ],
    },
  ] as never);
  expect(markdown).toContain("[[周报]]");
});

test("sanitizePageMentionProps 丢掉无 pageId 且无 wikiTarget 的节点", () => {
  expect(sanitizePageMentionProps({ title: "空" })).toBeNull();
  expect(sanitizePageMentionProps({ props: { pageId: " a ", title: "  " } })).toEqual({
    pageId: "a",
    workspaceId: "",
    title: "未命名",
    notebookName: "",
    wikiTarget: "",
  });
  expect(sanitizePageMentionProps({ wikiTarget: " 周报 " })).toEqual({
    pageId: "",
    workspaceId: "",
    title: "未命名",
    notebookName: "",
    wikiTarget: "周报",
  });
  expect(pageMentionLabel({ title: "周报" })).toBe("@周报");
});

test("createEditorSafeContent 保留 pageMention", () => {
  const content = createEditorSafeContent(
    [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "见" },
          { type: "pageMention", props: mention },
        ],
      },
    ],
    {
      blockSpecs: {
        paragraph: { config: { content: "inline", propSchema: {} } },
      },
    },
  );
  expect(content).toEqual([
    {
      type: "paragraph",
      content: [
        { type: "text", text: "见", styles: {} },
        { type: "pageMention", props: mention },
      ],
    },
  ]);
});

test("simpleExtractText 把 pageMention 抽成 @标题", () => {
  expect(
    simpleExtractText({
      type: "paragraph",
      content: [
        { type: "text", text: "见" },
        { type: "pageMention", props: mention },
      ],
    }),
  ).toBe("见@周报");
});

test("parseInlineMarkdown 读取 Obsidian 双链", () => {
  expect(pageMentionFromWikiLink("folder/Note.md|别名")).toEqual({
    pageId: "",
    workspaceId: "",
    title: "别名",
    notebookName: "",
    wikiTarget: "folder/Note",
  });
  expect(parseInlineMarkdown("见 [[周报#今日]] 和 [[a/b|显示]]")).toEqual([
    "见 ",
    {
      type: "pageMention",
      props: {
        pageId: "",
        workspaceId: "",
        title: "周报",
        notebookName: "",
        wikiTarget: "周报",
      },
    },
    " 和 ",
    {
      type: "pageMention",
      props: {
        pageId: "",
        workspaceId: "",
        title: "显示",
        notebookName: "",
        wikiTarget: "a/b",
      },
    },
  ]);
  expect(parseInlineMarkdown("图 [[cover.png]]")).toEqual(["图 ", "[[cover.png]]"]);
});

test("wikiTargetFromReference 用相对路径", () => {
  expect(
    wikiTargetFromReference({
      titleSnapshot: "Codex",
      localFilePath: "/vault/Dev/Codex.md",
      locationSnapshot: "Dev/Codex.md",
    }),
  ).toBe("Dev/Codex");
  expect(wikiTargetFromReference({ titleSnapshot: "周报" })).toBe("周报");
});

test("resolvePageMentionNavigation 会切笔记本并拒绝回收站", () => {
  const pages: Record<string, Page> = {
    "page-42": {
      id: "page-42",
      workspaceId: "nb-1",
      content: [],
      isLocked: false,
      fontSize: "default",
      fontFamily: "default",
      createdAt: 1,
      updatedAt: 1,
    },
    "page-gone": {
      id: "page-gone",
      workspaceId: "nb-1",
      content: [],
      isLocked: false,
      fontSize: "default",
      fontFamily: "default",
      createdAt: 1,
      updatedAt: 1,
      trashedAt: 2,
    },
  };
  expect(resolvePageMentionNavigation("page-42", pages, "nb-2")).toEqual({
    ok: true,
    page: pages["page-42"],
    switchNotebook: true,
  });
  expect(resolvePageMentionNavigation("page-42", pages, "nb-1")?.ok).toBe(true);
  expect(resolvePageMentionNavigation("page-42", pages, "nb-1")).toMatchObject({
    switchNotebook: false,
  });
  expect(resolvePageMentionNavigation("page-gone", pages, "nb-1")).toEqual({
    ok: false,
    reason: "trashed",
  });
  expect(resolvePageMentionNavigation("missing", pages, "nb-1")).toEqual({
    ok: false,
    reason: "missing",
  });
  expect(resolvePageMentionNavigation("  ", pages, "nb-1")).toEqual({
    ok: false,
    reason: "empty",
  });
});

test("resolvePageMentionNavigation 按双链标题/路径跳转", () => {
  const pages: Record<string, Page> = {
    "local-1": {
      id: "local-1",
      workspaceId: "nb-1",
      content: [],
      isLocked: false,
      fontSize: "default",
      fontFamily: "default",
      createdAt: 1,
      updatedAt: 1,
      localFilePath: "/vault/notes/周报.md",
    },
    "app-1": {
      id: "app-1",
      workspaceId: "nb-2",
      content: [
        {
          type: "heading",
          props: { level: 1 },
          content: [{ type: "text", text: "新手指南", styles: {} }],
        },
      ],
      isLocked: false,
      fontSize: "default",
      fontFamily: "default",
      createdAt: 1,
      updatedAt: 1,
    },
  };
  expect(resolvePageMentionNavigation("", pages, "nb-1", "周报")).toMatchObject({
    ok: true,
    page: pages["local-1"],
    switchNotebook: false,
  });
  expect(
    resolvePageMentionNavigation("", pages, "nb-1", "notes/周报.md"),
  ).toMatchObject({
    ok: true,
    page: pages["local-1"],
  });
  expect(resolvePageMentionNavigation("stale", pages, "nb-2", "新手指南")).toMatchObject({
    ok: true,
    page: pages["app-1"],
    switchNotebook: false,
  });
});

test("requestOpenPageMention 走注册的宿主回调", async () => {
  const { requestOpenPageMention, setPageMentionOpenHandler } = await import(
    "../../src/components/editor/inline/pageMentionBridge"
  );
  const opened: Array<{ id: string; wiki?: string }> = [];
  setPageMentionOpenHandler((id, wiki) => opened.push({ id, wiki }));
  expect(requestOpenPageMention(" page-1 ")).toBe(true);
  expect(requestOpenPageMention("", "周报")).toBe(true);
  expect(requestOpenPageMention("")).toBe(false);
  setPageMentionOpenHandler(null);
  expect(requestOpenPageMention("page-1")).toBe(false);
  expect(opened).toEqual([
    { id: "page-1", wiki: undefined },
    { id: "", wiki: "周报" },
  ]);
});
