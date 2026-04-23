import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { buildAgentPlan } from "../src/agent/core/runtime";
import { buildWorkspaceIntentRouterDeps } from "../src/agent/core/routerDeps";
import { useNotebooks } from "../src/stores/useNotebooks";
import { usePages } from "../src/stores/usePages";
import type { Page } from "../src/types";
import type { AISettingsLike } from "../src/lib/ai-provider";
import type { Notebook } from "../src/stores/useNotebooks";

const { classifyIntentMock } = vi.hoisted(() => ({
  classifyIntentMock: vi.fn(),
}));

vi.mock("../src/lib/ai-intent-router", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/ai-intent-router")>(
    "../src/lib/ai-intent-router",
  );
  return {
    ...actual,
    classifyIntent: classifyIntentMock,
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

function createPage(id: string, workspaceId: string, title: string): Page {
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

describe("AI workspace routing", () => {
  beforeEach(() => {
    classifyIntentMock.mockReset();
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
        "page-origin": createPage("page-origin", "nb-1", "当前页"),
        "page-ref": createPage("page-ref", "nb-1", "2026 年 SaaS 平台在 AI 冲击下的市场变动调研"),
      },
      activePageId: "page-origin",
    });
  });

  afterEach(() => {
    usePages.setState(originalPagesState);
    useNotebooks.setState(originalNotebooksState);
  });

  test("总结 @笔记 时会带上 router deps 并保持 chat-only", async () => {
    classifyIntentMock.mockResolvedValue({
      verdict: "chat_only",
      confidence: 0.83,
      reason: "reference_summary",
      source: "llm",
    });

    const payload = {
      promptText: "总结 @2026 年 SaaS 平台在 AI 冲击下的市场变动调研",
      freeformText: "总结 @2026 年 SaaS 平台在 AI 冲击下的市场变动调研",
      references: [
        {
          pageId: "page-ref",
          workspaceId: "nb-1",
          titleSnapshot: "2026 年 SaaS 平台在 AI 冲击下的市场变动调研",
          sourceType: "app-page" as const,
        },
      ],
      tokens: [
        { type: "text" as const, text: "总结 " },
        {
          type: "reference" as const,
          reference: {
            pageId: "page-ref",
            workspaceId: "nb-1",
            titleSnapshot: "2026 年 SaaS 平台在 AI 冲击下的市场变动调研",
            sourceType: "app-page" as const,
          },
        },
      ],
    };

    const routerDeps = buildWorkspaceIntentRouterDeps({
      settings,
      messages: [
        {
          id: "m1",
          role: "user",
          text: payload.promptText,
          references: payload.references,
        },
      ],
      originPageId: "page-origin",
      originNotebookId: "nb-1",
    });

    const planning = await buildAgentPlan(
      {
        surface: "workspace",
        payload,
        originPageId: "page-origin",
        originNotebookId: "nb-1",
      },
      routerDeps,
    );

    expect(routerDeps.originPageTitle).toBe("当前页");
    expect(routerDeps.originNotebookName).toBe("研究笔记");
    expect(classifyIntentMock).toHaveBeenCalledTimes(1);
    expect(planning.intent.capabilityId).toBe("note.chat");
    expect(planning.plan?.capabilityId).toBe("note.chat");
    expect(planning.parsed.intentClassification).toEqual({
      verdict: "chat_only",
      confidence: 0.83,
      reason: "reference_summary",
      source: "llm",
    });
  });

  test("follow-up 改写会优先命中最近写入目标而不走分类器", async () => {
    const planning = await buildAgentPlan({
      surface: "workspace",
      payload: {
        promptText: "继续改一下，更正式一点",
        freeformText: "继续改一下，更正式一点",
        references: [],
        tokens: [{ type: "text", text: "继续改一下，更正式一点" }],
      },
      originPageId: "page-origin",
      originNotebookId: "nb-1",
      stickyTarget: {
        pageId: "page-ref",
        workspaceId: "nb-1",
        defaultAction: "replace_page",
        source: "session_memory",
        pageTitle: "2026 年 SaaS 平台在 AI 冲击下的市场变动调研",
      },
      recentWriteTarget: {
        mode: "specific_page",
        pageId: "page-ref",
        source: "session_memory",
      },
    });

    expect(classifyIntentMock).not.toHaveBeenCalled();
    expect(planning.intent.capabilityId).toBe("note.replace");
    expect(planning.parsed.resolvedTarget.mode).toBe("specific_page");
    expect(planning.parsed.resolvedTarget.action).toBe("replace_page");
    expect(planning.parsed.resolvedTarget.pageId).toBe("page-ref");
  });
});
