import { expect, test } from "playwright/test";
import type { Page } from "../../src/types";
import type { Notebook } from "../../src/stores/useNotebooks";
import { getAiReferenceSuggestionItems } from "../../src/components/editor/ai/composer/referenceLookup";

function makePage(
  id: string,
  title: string,
  overrides: Partial<Page> = {},
): Page {
  return {
    id,
    workspaceId: "nb-1",
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
  "nb-1": {
    id: "nb-1",
    name: "skills",
    source: "local-folder",
    localPath: "/vault",
    createdAt: 1,
    updatedAt: 1,
  },
};

test("@server 精确文件名排在 feedback-server 前面", () => {
  const pages: Record<string, Page> = {
    feedback: makePage("feedback", "feedback-server", {
      localFilePath: "/vault/skills-project/feedback-server.md",
    }),
    exact: makePage("exact", "server", {
      localFilePath: "/vault/skills/ravenclaw/server.md",
    }),
    prefix: makePage("prefix", "server-auth-actions", {
      localFilePath: "/vault/skills/vercel/server-auth-actions.md",
    }),
  };

  const titles = getAiReferenceSuggestionItems(
    "server",
    pages,
    notebooks,
    "nb-1",
  ).map((item) => item.title);

  expect(titles[0]).toBe("server");
  expect(titles[1]).toBe("server-auth-actions");
  expect(titles).toContain("feedback-server");
  expect(titles.indexOf("server")).toBeLessThan(titles.indexOf("feedback-server"));
});

test("@ 建议不匹配笔记正文", () => {
  const pages: Record<string, Page> = {
    body: makePage("body", "无关标题", {
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            props: { level: 1 },
            content: [{ type: "text", text: "无关标题" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "这里反复提到 server 部署" }],
          },
        ],
      },
    }),
    title: makePage("title", "server"),
  };

  const ids = getAiReferenceSuggestionItems(
    "server",
    pages,
    notebooks,
    "nb-1",
  ).map((item) => item.pageId);

  expect(ids).toEqual(["title"]);
});

test("@ 建议不靠笔记本名命中全部笔记", () => {
  const pages: Record<string, Page> = {
    a: makePage("a", "周报"),
    b: makePage("b", "会议"),
  };
  const hits = getAiReferenceSuggestionItems(
    "skills",
    pages,
    notebooks,
    "nb-1",
  );
  expect(hits).toEqual([]);
});
