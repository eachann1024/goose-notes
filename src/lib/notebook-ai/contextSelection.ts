import type { ResolvedAiReferenceContext } from "@/components/editor/ai/composer/referenceLookup";
import type {
  NotebookAiContextBudgetTier,
  NotebookAiContextDiagnostics,
  NotebookAiContextMode,
} from "./types";

export const NOTEBOOK_AI_CONTEXT_CHARACTER_BUDGETS: Record<
  NotebookAiContextBudgetTier,
  number
> = {
  "summary-standard": 12_000,
  "full-text-standard": 30_000,
};

const FULL_TEXT_INTENT_PATTERN =
  /(全文|原文|逐段|逐句|逐字|完整内容|完整阅读|通读|精确汇总|精确总结|准确汇总|准确总结|逐条提取|全文翻译|全文改写|verbatim|full[ -]?text|paragraph[ -]?by[ -]?paragraph|exact (?:summary|wording)|quote (?:the )?original)/i;

/** 仅根据用户指令决定上下文级别，不读取 store，便于调用方预览。 */
export function selectNotebookAiContextMode(
  promptText: string,
): NotebookAiContextMode {
  return FULL_TEXT_INTENT_PATTERN.test(promptText)
    ? "full-text"
    : "structure-summary";
}

export function getNotebookAiContextBudgetTier(
  mode: NotebookAiContextMode,
): NotebookAiContextBudgetTier {
  return mode === "full-text" ? "full-text-standard" : "summary-standard";
}

function formatResolvedContext(
  context: ResolvedAiReferenceContext,
  index: number,
  mode: NotebookAiContextMode,
) {
  const sourceLabel =
    context.sourceType === "local-file" ? "本地文件" : "应用页面";
  const header = [
    `[引用 ${index + 1}]`,
    `标题：${context.title}`,
    `来源：${sourceLabel} · ${context.notebookName}`,
    `位置：${context.location}`,
  ];
  if (context.readStatus === "error") {
    return [
      ...header,
      "状态：读取失败",
      `错误：${context.errorMessage || "未知错误"}`,
    ].join("\n");
  }
  const content =
    mode === "full-text" ? context.contentText : context.structureSummary;
  return [...header, content || "（空白内容）"].join("\n");
}

export interface NotebookAiContextSelection {
  mode: NotebookAiContextMode;
  budgetTier: NotebookAiContextBudgetTier;
  characterBudget: number;
  contextBlock: string;
  diagnostics: NotebookAiContextDiagnostics;
}

/**
 * 将已解析引用按意图分级并应用总字符预算。纯函数不记录或返回 diagnostics 中的正文。
 */
export function buildNotebookAiContextSelection(params: {
  promptText: string;
  contexts: ResolvedAiReferenceContext[];
  uniqueReferenceCount?: number;
  occurrenceCount?: number;
  imageCount?: number;
}): NotebookAiContextSelection {
  const mode = selectNotebookAiContextMode(params.promptText);
  const budgetTier = getNotebookAiContextBudgetTier(mode);
  const characterBudget = NOTEBOOK_AI_CONTEXT_CHARACTER_BUDGETS[budgetTier];
  const unboundedBlock = params.contexts
    .map((context, index) => formatResolvedContext(context, index, mode))
    .join("\n\n");
  const contextBlock = unboundedBlock.slice(0, characterBudget);
  const readyCount = params.contexts.filter(
    (context) => context.readStatus === "ready",
  ).length;
  const failedCount = params.contexts.length - readyCount;

  return {
    mode,
    budgetTier,
    characterBudget,
    contextBlock,
    diagnostics: {
      uniqueReferenceCount:
        params.uniqueReferenceCount ?? params.contexts.length,
      occurrenceCount: params.occurrenceCount ?? params.contexts.length,
      summaryCount: mode === "structure-summary" ? readyCount : 0,
      fullTextCount: mode === "full-text" ? readyCount : 0,
      failedCount,
      contextCharacters: contextBlock.length,
      budgetTier,
      characterBudget,
      imageCount: params.imageCount,
    },
  };
}
