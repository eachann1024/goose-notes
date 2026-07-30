import { expect, test } from "vitest";
import type {
  AiComposerPayload,
  ResolvedAiReferenceContext,
} from "../../src/components/editor/ai/composer/referenceLookup";
import { normalizeAiComposerPayload } from "../../src/components/editor/ai/composer/referenceLookup";
import {
  buildNotebookAiContextSelection,
  NOTEBOOK_AI_CONTEXT_CHARACTER_BUDGETS,
  selectNotebookAiContextMode,
} from "../../src/lib/notebook-ai/context";

function createContext(
  pageId: string,
  overrides: Partial<ResolvedAiReferenceContext> = {},
): ResolvedAiReferenceContext {
  return {
    reference: {
      pageId,
      workspaceId: "notebook-1",
      titleSnapshot: `笔记 ${pageId}`,
      sourceType: "app-page",
    },
    title: `笔记 ${pageId}`,
    sourceType: "app-page",
    notebookName: "测试笔记本",
    location: "测试位置",
    contentText: `全文-${pageId}`,
    structureSummary: `摘要-${pageId}`,
    readStatus: "ready",
    ...overrides,
  };
}

test("按 prompt 意图选择结构摘要或全文", () => {
  expect(selectNotebookAiContextMode("概括这些笔记")).toBe(
    "structure-summary",
  );
  for (const prompt of ["精确汇总全文", "逐段分析", "引用原文", "全文翻译"]) {
    expect(selectNotebookAiContextMode(prompt)).toBe("full-text");
  }

  const summary = buildNotebookAiContextSelection({
    promptText: "概括一下",
    contexts: [createContext("a")],
  });
  expect(summary.contextBlock).toContain("摘要-a");
  expect(summary.contextBlock).not.toContain("全文-a");

  const fullText = buildNotebookAiContextSelection({
    promptText: "逐段分析原文",
    contexts: [createContext("a")],
  });
  expect(fullText.contextBlock).toContain("全文-a");
  expect(fullText.contextBlock).not.toContain("摘要-a");
});

test("全文上下文严格受字符预算限制", () => {
  const selection = buildNotebookAiContextSelection({
    promptText: "通读完整内容",
    contexts: [createContext("long", { contentText: "正".repeat(50_000) })],
  });

  expect(selection.contextBlock.length).toBe(
    NOTEBOOK_AI_CONTEXT_CHARACTER_BUDGETS["full-text-standard"],
  );
  expect(selection.diagnostics.contextCharacters).toBe(
    selection.contextBlock.length,
  );
});

test("diagnostics 只含统计，不包含正文", () => {
  const secretBody = "不应进入诊断元数据的正文";
  const selection = buildNotebookAiContextSelection({
    promptText: "精确总结",
    contexts: [
      createContext("ready", { contentText: secretBody }),
      createContext("failed", {
        contentText: "",
        structureSummary: "",
        readStatus: "error",
        errorMessage: "读取失败",
      }),
    ],
    uniqueReferenceCount: 2,
    occurrenceCount: 3,
    imageCount: 2,
  });

  expect(selection.diagnostics).toMatchObject({
    uniqueReferenceCount: 2,
    occurrenceCount: 3,
    summaryCount: 0,
    fullTextCount: 1,
    failedCount: 1,
    budgetTier: "full-text-standard",
    imageCount: 2,
  });
  expect(JSON.stringify(selection.diagnostics)).not.toContain(secretBody);
});

test("显式 target occurrence 不进入可读取上下文", () => {
  const target = createContext("target").reference;
  const context = createContext("context").reference;
  const payload: AiComposerPayload = {
    promptText: "参考上下文并写入目标",
    freeformText: "参考并写入",
    references: [context, target],
    images: [],
    tokens: [
      { type: "reference", reference: context, role: "context" },
      { type: "text", text: "写入" },
      { type: "reference", reference: target, role: "target" },
    ],
  };

  const normalized = normalizeAiComposerPayload(payload);
  expect(normalized.contextReferences.map((item) => item.pageId)).toEqual([
    "context",
  ]);
  expect(normalized.targetReferences.map((item) => item.pageId)).toEqual([
    "target",
  ]);
});
