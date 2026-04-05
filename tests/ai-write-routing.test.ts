import { describe, expect, test } from "vitest";
import {
  resolveAiTargetSelection,
  type AiStickyTarget,
  type AiTargetSelection,
} from "../src/lib/ai-write";
import type { AiComposerPayload } from "../src/pages/workspace/components/editor/ai-composer/referenceLookup";

function createPayload(promptText: string): AiComposerPayload {
  return {
    promptText,
    freeformText: promptText,
    references: [],
    tokens: [
      {
        type: "text",
        text: promptText,
      },
    ],
  };
}

describe("AI 写入目标路由", () => {
  test("跟进式改写会命中最近写入目标", () => {
    const recentWriteTarget: AiTargetSelection = {
      mode: "specific_page",
      pageId: "page-1",
      source: "session_memory",
    };

    const selection = resolveAiTargetSelection({
      payload: createPayload("再改一下，更正式一点"),
      recentWriteTarget,
      originPageId: "origin-page",
      originNotebookId: "notebook-1",
    });

    expect(selection).toEqual({
      mode: "specific_page",
      pageId: "page-1",
      source: "session_memory",
    });
  });

  test("显式引用目标页会覆盖手动选择", () => {
    const manualSelection: AiTargetSelection = {
      mode: "current_notebook",
      source: "selector",
    };

    const selection = resolveAiTargetSelection({
      payload: {
        promptText: "替换 @目标页",
        freeformText: "替换 @目标页",
        references: [
          {
            pageId: "page-2",
            workspaceId: "notebook-1",
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
              workspaceId: "notebook-1",
              titleSnapshot: "目标页",
              sourceType: "app-page",
            },
          },
        ],
      },
      manualSelection,
      originPageId: "origin-page",
      originNotebookId: "notebook-1",
    });

    expect(selection).toEqual({
      mode: "specific_page",
      pageId: "page-2",
      source: "reference",
    });
  });

  test("显式聊天会覆盖 sticky target", () => {
    const stickyTarget: AiStickyTarget = {
      pageId: "page-3",
      workspaceId: "notebook-1",
      defaultAction: "replace_page",
      source: "session_memory",
    };

    const selection = resolveAiTargetSelection({
      payload: createPayload("仅聊天，不要写入"),
      stickyTarget,
      originPageId: "origin-page",
      originNotebookId: "notebook-1",
    });

    expect(selection).toEqual({
      mode: "chat_only",
      source: "prompt_rule",
    });
  });

  test("模糊生成请求返回 ambiguous（交由 LLM 路由）", () => {
    const stickyTarget: AiStickyTarget = {
      pageId: "page-4",
      workspaceId: "notebook-1",
      defaultAction: "replace_page",
      source: "session_memory",
    };

    const selection = resolveAiTargetSelection({
      payload: createPayload("帮我生成一份项目周报"),
      stickyTarget,
      originPageId: "origin-page",
      originNotebookId: "notebook-1",
    });

    expect(selection.mode).toBe("ambiguous");
  });

  test("空提示返回 ambiguous（交由 LLM 路由）", () => {
    const selection = resolveAiTargetSelection({
      payload: createPayload(""),
      originPageId: "origin-page",
      originNotebookId: "notebook-1",
    });

    expect(selection.mode).toBe("ambiguous");
  });

  test("follow-up 编辑 + stickyTarget 命中", () => {
    const stickyTarget: AiStickyTarget = {
      pageId: "page-sticky",
      workspaceId: "notebook-1",
      defaultAction: "replace_page",
      source: "session_memory",
    };

    const selection = resolveAiTargetSelection({
      payload: createPayload("继续改，更口语一点"),
      stickyTarget,
      originPageId: "origin-page",
      originNotebookId: "notebook-1",
    });

    expect(selection).toEqual({
      mode: "specific_page",
      pageId: "page-sticky",
      source: "session_memory",
    });
  });
});
