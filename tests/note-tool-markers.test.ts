import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { buildAgentPlan, executeAgentPlan } from "../src/agent/core/runtime";
import {
  buildToolContinuationPrompt,
  executeNoteToolMarker,
  parseNoteToolMarker,
} from "../src/agent/capabilities/note/toolMarkers";
import { useNotebooks } from "../src/stores/useNotebooks";
import { usePages } from "../src/stores/usePages";
import type { Page } from "../src/types";
import type { AISettingsLike } from "../src/lib/ai-provider";
import type { Notebook } from "../src/stores/useNotebooks";

const { runAITextStreamMock } = vi.hoisted(() => ({
  runAITextStreamMock: vi.fn(),
}));

vi.mock("../src/lib/ai-provider", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/ai-provider")>(
    "../src/lib/ai-provider",
  );
  return {
    ...actual,
    runAITextStream: runAITextStreamMock,
  };
});

const settings: AISettingsLike = {
  enabled: true,
  selectedModelId: "model-1",
  workspaceReasoningLevel: "default",
  useCustomProvider: true,
  customProtocol: "openai",
  customOpenAIBaseURL: "https://example.com/v1",
  customClaudeBaseURL: "https://example.com/v1",
  customOpenAIApiKey: "key",
  customClaudeApiKey: "key",
  customModelOptions: [{ id: "model-1", label: "Model 1" }],
};

const originalPagesState = {
  pages: usePages.getState().pages,
  activePageId: usePages.getState().activePageId,
};
const originalNotebooksState = {
  notebooks: useNotebooks.getState().notebooks,
  activeNotebookId: useNotebooks.getState().activeNotebookId,
};

function createPage(id: string, workspaceId: string, title: string, body: string): Page {
  return {
    id,
    workspaceId,
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: title }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: body }],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "结论摘要" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "传统功能型 SaaS 承压，AI 原生平台增长更快。" }],
        },
      ],
    },
    isLocked: false,
    isFullWidth: false,
    fontSize: "default",
    fontFamily: "default",
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("note tool markers", () => {
  beforeEach(() => {
    runAITextStreamMock.mockReset();
    const notebook: Notebook = {
      id: "nb-1",
      name: "研究笔记",
      createdAt: 1,
      updatedAt: 1,
    };

    useNotebooks.setState({
      notebooks: { "nb-1": notebook },
      activeNotebookId: "nb-1",
    });
    usePages.setState({
      pages: {
        "page-origin": createPage("page-origin", "nb-1", "当前页", "这里只是当前页内容。"),
        "page-dev": createPage("page-dev", "nb-1", "开发笔记", "这里记录版本变化与问题复盘。"),
      },
      activePageId: "page-origin",
    });
  });

  afterEach(() => {
    usePages.setState(originalPagesState);
    useNotebooks.setState(originalNotebooksState);
  });

  test("能解析并执行 read / read-section 标记", () => {
    expect(parseNoteToolMarker("<!--read:开发笔记-->")).toEqual({
      type: "read",
      argument: "开发笔记",
    });
    expect(parseNoteToolMarker("<!--read-section:开发笔记#结论摘要-->")).toEqual({
      type: "read-section",
      argument: "开发笔记#结论摘要",
    });

    expect(
      executeNoteToolMarker(
        { type: "read", argument: "开发笔记" },
        { originNotebookId: "nb-1" },
      ),
    ).toContain("# 开发笔记");
    expect(
      executeNoteToolMarker(
        { type: "read-section", argument: "开发笔记#结论摘要" },
        { originNotebookId: "nb-1" },
      ),
    ).toContain("传统功能型 SaaS 承压");
  });

  test("遇到 read 标记时会自动续跑并返回最终答案", async () => {
    runAITextStreamMock
      .mockResolvedValueOnce("<!--read:开发笔记-->")
      .mockResolvedValueOnce("这份开发笔记的重点是：传统功能型 SaaS 承压，而 AI 原生平台增长更快。");

    const planning = await buildAgentPlan({
      surface: "workspace",
      payload: {
        promptText: "只回答，帮我总结这个笔记 @开发笔记",
        freeformText: "只回答，帮我总结这个笔记 @开发笔记",
        references: [
          {
            pageId: "page-dev",
            workspaceId: "nb-1",
            titleSnapshot: "开发笔记",
            sourceType: "app-page",
          },
        ],
        tokens: [
          { type: "text", text: "只回答，帮我总结这个笔记 " },
          {
            type: "reference",
            reference: {
              pageId: "page-dev",
              workspaceId: "nb-1",
              titleSnapshot: "开发笔记",
              sourceType: "app-page",
            },
          },
        ],
      },
      originPageId: "page-origin",
      originNotebookId: "nb-1",
    });

    expect(planning.plan?.capabilityId).toBe("note.chat");

    const result = await executeAgentPlan({
      settings,
      plan: planning.plan!,
      context: {
        surface: "workspace",
        payload: planning.parsed.payload,
        originPageId: "page-origin",
        originNotebookId: "nb-1",
      },
      parsed: planning.parsed,
    });

    expect(runAITextStreamMock).toHaveBeenCalledTimes(2);
    const secondCallMessages = runAITextStreamMock.mock.calls[1][1] as Array<{ role: string; content?: string }>;
    expect(secondCallMessages.at(-2)?.content).toBe("<!--read:开发笔记-->");
    expect(secondCallMessages.at(-1)?.content).toBe(
      buildToolContinuationPrompt(
        executeNoteToolMarker(
          { type: "read", argument: "开发笔记" },
          { originNotebookId: "nb-1" },
        ),
      ),
    );
    expect(result.artifact.type).toBe("text_response");
    expect(result.artifact.type === "text_response" ? result.artifact.text : "").toContain(
      "AI 原生平台增长更快",
    );
  });
});
