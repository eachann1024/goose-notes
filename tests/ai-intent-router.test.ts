import { describe, expect, test, vi, beforeEach } from "vitest";
import {
  verdictToTargetMode,
  buildIntentRouterContext,
  parseIntentResponse,
  type IntentVerdict,
} from "../src/lib/ai-intent-router";
import type { AiSessionMessage } from "../src/stores/useAiSessions";
import { parseNoteAgentInput } from "../src/agent/capabilities/note";
import type { AISettingsLike } from "../src/lib/ai-provider";

const classifyIntentMock = vi.fn();

vi.mock("../src/lib/ai-intent-router", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/ai-intent-router")>("../src/lib/ai-intent-router");
  return {
    ...actual,
    classifyIntent: classifyIntentMock,
  };
});

function createPayload(promptText: string) {
  return {
    promptText,
    freeformText: promptText,
    references: [],
    tokens: [{ type: "text" as const, text: promptText }],
  };
}

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

const routerDeps = {
  settings,
  messages: [] as AiSessionMessage[],
  originPageTitle: "当前页",
  originNotebookName: "工作台",
};

describe("verdictToTargetMode", () => {
  test("edit_current + 有 originPage → current_page", () => {
    expect(verdictToTargetMode("edit_current", true, false)).toBe("current_page");
  });

  test("edit_current + 无 originPage → chat_only", () => {
    expect(verdictToTargetMode("edit_current", false, false)).toBe("chat_only");
  });

  test("create_new + 有 originNotebook → current_notebook", () => {
    expect(verdictToTargetMode("create_new", false, true)).toBe("current_notebook");
  });

  test("create_new + 无 originNotebook → chat_only", () => {
    expect(verdictToTargetMode("create_new", false, false)).toBe("chat_only");
  });

  test("chat_only 始终返回 chat_only", () => {
    expect(verdictToTargetMode("chat_only", true, true)).toBe("chat_only");
  });
});

describe("parseIntentResponse", () => {
  test("正确解析合法 JSON", () => {
    const result = parseIntentResponse(
      '{"verdict":"edit_current","confidence":0.9,"reason":"follow_up_edit"}',
    );
    expect(result).toEqual({
      verdict: "edit_current",
      confidence: 0.9,
      reason: "follow_up_edit",
      source: "fallback",
    });
  });

  test("兼容 markdown 代码围栏包裹", () => {
    const result = parseIntentResponse(
      '```json\n{"verdict":"create_new","confidence":0.8,"reason":"explicit_create"}\n```',
    );
    expect(result.verdict).toBe("create_new");
    expect(result.confidence).toBe(0.8);
  });

  test("无效 verdict 返回 fallback", () => {
    const result = parseIntentResponse(
      '{"verdict":"invalid_value","confidence":0.5,"reason":"test"}',
    );
    expect(result.verdict).toBe("chat_only");
    expect(result.reason).toBe("parse_error");
  });

  test("无 JSON 块返回 fallback", () => {
    const result = parseIntentResponse("This is just text without JSON");
    expect(result.verdict).toBe("chat_only");
    expect(result.reason).toBe("parse_error");
  });

  test("confidence 被 clamp 到 0-1", () => {
    const result = parseIntentResponse(
      '{"verdict":"chat_only","confidence":2.5,"reason":"test"}',
    );
    expect(result.confidence).toBe(1);
  });

  test("缺失 confidence 默认 0.5", () => {
    const result = parseIntentResponse(
      '{"verdict":"chat_only","reason":"test"}',
    );
    expect(result.confidence).toBe(0.5);
  });

  test("reason 截断到 40 字符", () => {
    const longReason = "a".repeat(100);
    const result = parseIntentResponse(
      `{"verdict":"chat_only","confidence":0.5,"reason":"${longReason}"}`,
    );
    expect(result.reason.length).toBe(40);
  });
});

describe("buildIntentRouterContext", () => {
  test("正确构建上下文", () => {
    const messages: AiSessionMessage[] = [
      { id: "1", role: "user", text: "帮我写一篇小红书文案" },
      { id: "2", role: "assistant", text: "好的，已经为你生成了一篇小红书文案..." },
      { id: "3", role: "user", text: "太长了缩短一点" },
    ];

    const context = buildIntentRouterContext({
      userMessage: "太长了缩短一点",
      messages,
      originPageTitle: "我的测试页",
      originNotebookName: "工作笔记本",
      stickyTarget: {
        pageId: "page-1",
        workspaceId: "nb-1",
        defaultAction: "replace_page",
        source: "session_memory",
        pageTitle: "小红书文案",
      },
      lastArtifact: { type: "markdown_note", plan: {} as any },
    });

    expect(context.userMessage).toBe("太长了缩短一点");
    expect(context.currentPageTitle).toBe("我的测试页");
    expect(context.currentNotebookName).toBe("工作笔记本");
    expect(context.lastWrittenPageTitle).toBe("小红书文案");
    expect(context.lastAssistantAction).toBe("wrote_content");
    expect(context.recentMessages).toHaveLength(3);
    expect(context.recentMessages[0].summary.length).toBeLessThanOrEqual(100);
  });

  test("text_response artifact → chat_response", () => {
    const context = buildIntentRouterContext({
      userMessage: "什么是 markdown？",
      messages: [],
      lastArtifact: { type: "text_response", text: "Markdown is..." },
    });

    expect(context.lastAssistantAction).toBe("chat_response");
  });

  test("无 artifact 时 lastAssistantAction 为 undefined", () => {
    const context = buildIntentRouterContext({
      userMessage: "你好",
      messages: [],
    });

    expect(context.lastAssistantAction).toBeUndefined();
  });
});

describe("parseNoteAgentInput", () => {
  beforeEach(() => {
    classifyIntentMock.mockReset();
  });

  test("ambiguous + classify=edit_current → 当前页写入", async () => {
    classifyIntentMock.mockResolvedValue({
      verdict: "edit_current",
      confidence: 0.9,
      reason: "follow_up_edit",
      source: "llm",
    });

    const parsed = await parseNoteAgentInput(
      {
        surface: "workspace",
        payload: createPayload("帮我生成一份项目周报"),
        originPageId: "page-1",
        originNotebookId: "nb-1",
      },
      routerDeps,
    );

    expect(parsed.resolvedTarget.mode).toBe("current_page");
    expect(parsed.resolvedTarget.action).toBe("replace_page");
    expect(parsed.intentClassification).toEqual({
      verdict: "edit_current",
      confidence: 0.9,
      reason: "follow_up_edit",
      source: "llm",
    });
  });

  test("ambiguous + classify=create_new → 当前笔记本新建", async () => {
    classifyIntentMock.mockResolvedValue({
      verdict: "create_new",
      confidence: 0.8,
      reason: "explicit_create",
      source: "llm",
    });

    const parsed = await parseNoteAgentInput(
      {
        surface: "workspace",
        payload: createPayload("帮我生成一份项目周报"),
        originPageId: "page-1",
        originNotebookId: "nb-1",
      },
      routerDeps,
    );

    expect(parsed.resolvedTarget.mode).toBe("current_notebook");
    expect(parsed.resolvedTarget.action).toBe("create_root_page");
    expect(parsed.intentClassification?.verdict).toBe("create_new");
  });

  test("ambiguous + classify=chat_only → chat-only", async () => {
    classifyIntentMock.mockResolvedValue({
      verdict: "chat_only",
      confidence: 0.7,
      reason: "question",
      source: "llm",
    });

    const parsed = await parseNoteAgentInput(
      {
        surface: "workspace",
        payload: createPayload("帮我生成一份项目周报"),
        originPageId: "page-1",
        originNotebookId: "nb-1",
      },
      routerDeps,
    );

    expect(parsed.resolvedTarget.mode).toBe("chat_only");
    expect(parsed.resolvedTarget.action).toBe("chat_only");
    expect(parsed.intentClassification?.verdict).toBe("chat_only");
  });

  test("ambiguous + 无 routerDeps → 继续走当前兜底逻辑", async () => {
    const parsed = await parseNoteAgentInput({
      surface: "workspace",
      payload: createPayload("帮我生成一份项目周报"),
      originPageId: "page-1",
      originNotebookId: "nb-1",
    });

    expect(parsed.resolvedTarget.mode).toBe("current_page");
    expect(parsed.intentClassification).toBeUndefined();
    expect(classifyIntentMock).not.toHaveBeenCalled();
  });

  test("显式目标引用时不调用 LLM", async () => {
    const parsed = await parseNoteAgentInput(
      {
        surface: "workspace",
        payload: {
          promptText: "替换 @目标页",
          freeformText: "替换 @目标页",
          references: [
            {
              pageId: "page-2",
              workspaceId: "nb-1",
              titleSnapshot: "目标页",
              sourceType: "app-page",
            },
          ],
          tokens: [
            { type: "text", text: "替换 " },
            {
              type: "reference",
              reference: {
                pageId: "page-2",
                workspaceId: "nb-1",
                titleSnapshot: "目标页",
                sourceType: "app-page",
              },
            },
          ],
        },
        originPageId: "page-1",
        originNotebookId: "nb-1",
      },
      routerDeps,
    );

    expect(parsed.resolvedTarget.mode).toBe("specific_page");
    expect(classifyIntentMock).not.toHaveBeenCalled();
  });

  test("follow-up 快速路径命中时不调用 LLM", async () => {
    const parsed = await parseNoteAgentInput(
      {
        surface: "workspace",
        payload: createPayload("再改一下，更正式一点"),
        stickyTarget: {
          pageId: "page-sticky",
          workspaceId: "nb-1",
          defaultAction: "replace_page",
          source: "session_memory",
        },
        originPageId: "page-1",
        originNotebookId: "nb-1",
      },
      routerDeps,
    );

    expect(parsed.resolvedTarget.mode).toBe("specific_page");
    expect(classifyIntentMock).not.toHaveBeenCalled();
  });
});
