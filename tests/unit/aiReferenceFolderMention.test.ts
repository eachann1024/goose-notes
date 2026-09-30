import { expect, test } from "playwright/test";
import type { Page } from "../../src/types";
import type { Notebook } from "../../src/stores/useNotebooks";
import {
  buildAiFileReferenceAttrs,
  getAiReferenceSuggestionItems,
  resolveAiReferenceContexts,
} from "../../src/components/editor/ai/composer/referenceLookup";

function makePage(
  id: string,
  title: string,
  overrides: Partial<Page> = {},
): Page {
  return {
    id,
    workspaceId: "nb-local",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          props: { level: 1 },
          content: [{ type: "text", text: title }],
        },
      ],
    },
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

const notebooks: Record<string, Notebook> = {
  "nb-local": {
    id: "nb-local",
    name: "ravenclaw",
    source: "local-folder",
    localPath: "/repo",
    createdAt: 1,
    updatedAt: 1,
  },
};

const pages: Record<string, Page> = {
  browser: makePage("browser", "browser", {
    isFolder: true,
    localFilePath: "/repo/browser",
  }),
  "browser-md": makePage("browser-md", "index", {
    parentId: "browser",
    localFilePath: "/repo/browser/index.md",
  }),
  client: makePage("client", "client", {
    isFolder: true,
    localFilePath: "/repo/client",
  }),
};

test("本地文件夹 @ 建议包含目录节点", () => {
  const items = getAiReferenceSuggestionItems(
    "browser",
    pages,
    notebooks,
    "nb-local",
    { notebookId: "nb-local", includeFolders: true },
  );
  expect(items.some((item) => item.pageId === "browser" && item.isFolder)).toBe(
    true,
  );
  expect(items.some((item) => item.pageId === "browser-md")).toBe(true);
});

test("应用内笔记本默认建议仍排除目录", () => {
  const items = getAiReferenceSuggestionItems(
    "browser",
    pages,
    notebooks,
    "nb-local",
    { notebookId: "nb-local" },
  );
  expect(items.every((item) => !item.isFolder)).toBe(true);
});

test("目录引用上下文列出子项，不读文件夹正文", () => {
  const reference = buildAiFileReferenceAttrs(pages.browser, notebooks);
  const [context] = resolveAiReferenceContexts([reference], pages, notebooks);
  expect(context.readStatus).toBe("ready");
  expect(context.structureSummary).toContain("1 个子项");
  expect(context.structureSummary).toContain("- index");
  expect(context.contentText).toContain("目录子项");
});
