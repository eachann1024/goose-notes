import type {
  AgentComposerToken,
  AgentInputContext,
  AgentParsedInput,
} from "@/agent/core/types";
import {
  resolveAiTargetReference,
  resolveAiTargetSelection,
  resolveAiTargetIntent,
  createAiChatOnlyTarget,
  type AiTargetSelection,
} from "@/lib/ai-write";
import {
  buildIntentRouterContext,
  classifyIntent,
  verdictToTargetMode,
} from "@/lib/ai-intent-router";
import { usePages } from "@/stores/usePages";
import { resolveBlockScope } from "@/lib/ai-block-scope";
import type { AISettingsLike } from "@/lib/ai-provider";
import type { AiSessionMessage } from "@/stores/useAiSessions";

export function buildInlinePrompt(params: {
  context: AgentInputContext;
  parsed: AgentParsedInput;
}) {
  const { context, parsed } = params;
  const finalQuery = parsed.payload.promptText.trim();
  const text = context.selectionText?.trim() ?? "";
  const blockText = context.blockText?.trim() ?? "";
  const isPartial = Boolean(text && blockText && text !== blockText);

  if (!text && !finalQuery) {
    return "";
  }

  if (text) {
    if (!finalQuery) {
      if (context.initialAction === "polish") {
        return isPartial
          ? `完整句子是：「${blockText}」\n其中「${text}」需要润色。请只输出润色后用来替换「${text}」的文字，保持与前后文衔接自然，不要输出完整句子，不要解释。`
          : `请润色下面这段中文，保留原意，只输出润色结果：\n\n${text}`;
      }

      if (context.initialAction === "rewrite") {
        return isPartial
          ? `完整句子是：「${blockText}」\n其中「${text}」需要改写得更正式。请只输出改写后用来替换「${text}」的文字，保持与前后文衔接自然，不要输出完整句子，不要解释。`
          : `请将下面内容改写得更正式、更适合文档语气，只输出改写结果：\n\n${text}`;
      }

      return `请处理这段文本，只输出处理结果：\n\n${text}`;
    }

    return isPartial
      ? `完整句子是：「${blockText}」\n其中「${text}」需要处理。任务：${finalQuery}\n请只输出用来替换「${text}」的文字，不要输出完整句子，不要解释。`
      : `针对以下文本执行任务：${finalQuery}\n\n文本：${text}`;
  }

  return finalQuery;
}

export interface IntentRouterDeps {
  settings: AISettingsLike;
  messages: AiSessionMessage[];
  lastArtifact?: any;
  originPageTitle?: string;
  originNotebookName?: string;
}

export async function parseNoteAgentInput(
  context: AgentInputContext,
  routerDeps?: IntentRouterDeps,
): Promise<AgentParsedInput> {
  const targetRefMatch =
    context.surface === "workspace"
      ? resolveAiTargetReference(context.payload)
      : null;

  let selection: AiTargetSelection | null = context.surface === "workspace"
    ? resolveAiTargetSelection({
        payload: context.payload,
        manualSelection: context.manualTargetSelection,
        stickyTarget: context.stickyTarget,
        recentWriteTarget: context.recentWriteTarget,
        originPageId: context.originPageId,
        originNotebookId: context.originNotebookId,
      })
    : null;
  let intentClassification: AgentParsedInput["intentClassification"];

  // 如果确定性路径返回 "ambiguous"，尝试 LLM 路由
  if (selection?.mode === "ambiguous") {
    if (routerDeps) {
      const routerContext = buildIntentRouterContext({
        userMessage: context.payload.promptText,
        messages: routerDeps.messages,
        originPageTitle: routerDeps.originPageTitle,
        originNotebookName: routerDeps.originNotebookName,
        stickyTarget: context.stickyTarget,
        lastArtifact: routerDeps.lastArtifact,
      });

      const result = await classifyIntent(routerDeps.settings, routerContext);
      const mappedMode = verdictToTargetMode(
        result.verdict,
        Boolean(context.originPageId),
        Boolean(context.originNotebookId),
      );

      intentClassification = {
        verdict: result.verdict,
        confidence: result.confidence,
        reason: result.reason,
        source: result.source,
      };

      selection = {
        mode: mappedMode,
        source: "llm_router",
      };
    } else {
      // 无 LLM 依赖时用保守兜底：不自动覆写当前页，歧义请求默认新建或聊天
      selection = {
        mode: context.originNotebookId
          ? "current_notebook"
          : "chat_only",
        source: "prompt_rule",
      };
    }
  }

  let resolvedTarget =
    context.surface === "workspace" && selection
      ? resolveAiTargetIntent({
          payload: context.payload,
          selection,
          originPageId: context.originPageId,
          originNotebookId: context.originNotebookId,
        })
      : createAiChatOnlyTarget();

  // 当 action 为 replace_page 且目标就是当前页时，尝试将范围收窄到选区/章节/前后 N 块。
  if (
    context.surface === "workspace" &&
    resolvedTarget.action === "replace_page" &&
    resolvedTarget.pageId &&
    resolvedTarget.pageId === context.originPageId
  ) {
    const page = usePages.getState().pages[resolvedTarget.pageId];
    const scope = await resolveBlockScope({
      prompt: context.payload.freeformText || context.payload.promptText,
      page,
      settings: routerDeps?.settings ?? null,
    });
    if (scope?.kind === "range") {
      resolvedTarget = {
        ...resolvedTarget,
        action: "replace_block_range",
        range: {
          startBlockId: scope.startBlockId,
          endBlockId: scope.endBlockId,
          rangeLabel: scope.rangeLabel,
          blockCount: scope.blockCount,
        },
        targetLabel: `重写「${scope.rangeLabel}」`,
      };
    }
  }

  const tokens = context.payload.tokens.map((token, index) => {
    if (token.type !== "reference") {
      return token;
    }
    return {
      ...token,
      role:
        targetRefMatch && index === targetRefMatch.tokenIndex
          ? "target"
          : "context",
    } satisfies AgentComposerToken;
  });

  return {
    payload: {
      ...context.payload,
      tokens,
    },
    normalizedPrompt: (context.payload.freeformText || context.payload.promptText)
      .replace(/\s+/g, "")
      .toLowerCase(),
    targetReference: targetRefMatch?.reference ?? null,
    resolvedTarget,
    ...(intentClassification ? { intentClassification } : {}),
  };
}
