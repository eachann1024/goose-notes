/**
 * LLM 意图路由模块
 *
 * 两阶段架构：确定性快速路径（正则）+ LLM 意图分类
 * 用于替代手动目标选择器，实现 Notion AI 级别的自动意图推断
 */

import { runAIText } from "@/lib/ai-provider";
import type { AISettingsLike } from "@/lib/ai-provider";
import type { AiTargetMode, AiStickyTarget } from "@/lib/ai-write";
import type { AiSessionMessage } from "@/stores/useAiSessions";
import type { AgentArtifact, AgentIntentClassification } from "@/agent/core/types";

// ── 类型定义 ──

/** LLM 意图分类结果 */
export type IntentVerdict = "edit_current" | "create_new" | "chat_only";

export interface IntentRouterContext {
  /** 用户本轮输入 */
  userMessage: string;
  /** 最近 3-5 条消息的摘要（role + 前 100 字） */
  recentMessages: Array<{ role: "user" | "assistant"; summary: string }>;
  /** 当前页面标题（用户从哪个页面进入 AI 页面的） */
  currentPageTitle?: string;
  /** 当前笔记本名称 */
  currentNotebookName?: string;
  /** 上次写入的页面标题（stickyTarget） */
  lastWrittenPageTitle?: string;
  /** 上一轮 AI 输出类型 */
  lastAssistantAction?: "wrote_content" | "chat_response";
}

export interface IntentRouterResult extends AgentIntentClassification {
  verdict: IntentVerdict;
  /** 0-1，用于埋点分析 */
  confidence: number;
  /** 简短标签，如 "follow_up_edit", "explicit_create", "question" */
  reason: string;
}

function createIntentFallback(
  reason: "timeout" | "aborted" | "parse_error" | "llm_error",
): IntentRouterResult {
  return {
    verdict: "chat_only",
    confidence: 0,
    reason,
    source: "fallback",
  };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function mergeAbortSignals(signals: Array<AbortSignal | undefined>) {
  const controller = new AbortController();
  const listeners: Array<() => void> = [];

  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      controller.abort();
      break;
    }
    const onAbort = () => controller.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    listeners.push(() => signal.removeEventListener("abort", onAbort));
  }

  return {
    signal: controller.signal,
    cleanup: () => listeners.forEach((dispose) => dispose()),
  };
}

function parseIntentResponseWithSource(text: string): IntentRouterResult {
  const parsed = parseIntentResponse(text);
  return parsed.reason === "parse_error"
    ? parsed
    : {
        ...parsed,
        source: "llm",
      };
}

function buildTimeoutController(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

function getFallbackReason(error: unknown, timedOut: boolean) {
  if (timedOut) return "timeout" as const;
  if (isAbortError(error)) return "aborted" as const;
  return "llm_error" as const;
}

function hasParseFallback(result: IntentRouterResult) {
  return result.source === "fallback" && result.reason === "parse_error";
}


// ── Prompt 模板 ──

const INTENT_CLASSIFIER_SYSTEM_PROMPT = `You are an intent classifier for a note-taking app's AI assistant.

Given the user's message and conversation context, classify the user's intent into exactly one of:
- "edit_current": The user EXPLICITLY wants to revise, rewrite, or continue editing specific content that was previously generated. Only use this when the user clearly refers to prior output (e.g., "make it shorter", "change the tone", "rewrite this part", "add more detail to that").
- "create_new": The user EXPLICITLY wants to generate a brand new document or page. Only use this when the user clearly requests creation (e.g., "write me an article about...", "create a new page for...", "generate a template").
- "chat_only": The user is chatting, asking questions, giving feedback, or any message that does NOT explicitly request writing or editing content.

STRICT RULES:
- Greetings, casual conversation, thanks, acknowledgements → always "chat_only"
- General questions (what, how, why, when) → always "chat_only"
- Vague messages with no clear write intent → always "chat_only"
- Only classify as "edit_current" or "create_new" when the intent is unambiguous

Default to "chat_only" when unsure.

Respond with ONLY a JSON object: {"verdict":"...","confidence":0.0-1.0,"reason":"short_tag"}`;

function buildIntentUserPrompt(context: IntentRouterContext): string {
  const recentLines = context.recentMessages
    .map((m) => `${m.role}: ${m.summary}`)
    .join("\n");

  return [
    "Context:",
    `- Current page: ${context.currentPageTitle || "none"}`,
    `- Notebook: ${context.currentNotebookName || "none"}`,
    `- Last written page: ${context.lastWrittenPageTitle || "none"}`,
    `- Last assistant action: ${context.lastAssistantAction || "none"}`,
    "",
    "Recent conversation:",
    recentLines || "(none)",
    "",
    "Current user message:",
    context.userMessage,
  ].join("\n");
}

// ── 核心函数 ──

/**
 * 使用 LLM 做意图分类
 * - 跟随主模型 provider（uTools 或自定义）
 * - 超时 3 秒自动 fallback 到 chat_only
 * - 使用 generateText + JSON 格式约束（非 generateObject，兼容 uTools）
 */
export async function classifyIntent(
  settings: AISettingsLike,
  context: IntentRouterContext,
  options?: { timeoutMs?: number; abortSignal?: AbortSignal },
): Promise<IntentRouterResult> {
  const timeoutMs = options?.timeoutMs ?? 3000;
  const timeoutController = buildTimeoutController(timeoutMs);
  const merged = mergeAbortSignals([options?.abortSignal, timeoutController.signal]);

  try {
    const rawText = await runAIText(
      settings,
      [
        { role: "system", content: INTENT_CLASSIFIER_SYSTEM_PROMPT },
        { role: "user", content: buildIntentUserPrompt(context) },
      ],
      {
        abortSignal: merged.signal,
        requestOverrides: {
          selectedModelId: settings.selectedModelId,
          reasoningLevel: "default",
        },
      },
    );

    const parsed = parseIntentResponseWithSource(rawText);
    return hasParseFallback(parsed) ? createIntentFallback("parse_error") : parsed;
  } catch (error) {
    return createIntentFallback(
      getFallbackReason(error, timeoutController.signal.aborted && !options?.abortSignal?.aborted),
    );
  } finally {
    merged.cleanup();
    timeoutController.clear();
  }
}

/** 从 LLM 返回文本中提取 JSON 并解析 */
export function parseIntentResponse(text: string): IntentRouterResult {
  const fallback = createIntentFallback("parse_error");

  try {
    // 提取第一个 {...} 块（兼容 markdown 代码围栏包裹）
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]);

    const validVerdicts: IntentVerdict[] = [
      "edit_current",
      "create_new",
      "chat_only",
    ];
    if (!validVerdicts.includes(parsed.verdict)) return fallback;

    return {
      verdict: parsed.verdict,
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5,
      reason:
        typeof parsed.reason === "string"
          ? parsed.reason.slice(0, 40)
          : "llm_classified",
      source: "fallback",
    };
  } catch {
    return fallback;
  }
}

/**
 * 将 LLM verdict 映射回现有的 AiTargetMode
 *
 * - "edit_current" → 有 originPage 则 "current_page"，否则 "chat_only"
 * - "create_new" → 有 originNotebook 则 "current_notebook"，否则 "chat_only"
 * - "chat_only" → "chat_only"
 */
export function verdictToTargetMode(
  verdict: IntentVerdict,
  hasOriginPage: boolean,
  hasOriginNotebook: boolean,
): AiTargetMode {
  switch (verdict) {
    case "edit_current":
      return hasOriginPage ? "current_page" : "chat_only";
    case "create_new":
      return hasOriginNotebook ? "current_notebook" : "chat_only";
    case "chat_only":
      return "chat_only";
  }
}

/**
 * 从 AiSessionMessage[] 构建 IntentRouterContext
 */
export function buildIntentRouterContext(params: {
  userMessage: string;
  messages: AiSessionMessage[];
  originPageTitle?: string;
  originNotebookName?: string;
  stickyTarget?: AiStickyTarget | null;
  lastArtifact?: AgentArtifact | null;
}): IntentRouterContext {
  const { userMessage, messages, originPageTitle, originNotebookName, stickyTarget, lastArtifact } = params;

  // 取最后 5 条，每条截取前 100 字作为 summary
  const recentMessages = messages
    .slice(-5)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      summary: (m.text || "").slice(0, 100),
    }));

  // 从 lastArtifact 推断上一轮 AI 动作
  const lastAssistantAction: "wrote_content" | "chat_response" | undefined =
    lastArtifact?.type === "markdown_note"
      ? "wrote_content"
      : lastArtifact?.type === "text_response"
        ? "chat_response"
        : undefined;

  return {
    userMessage,
    recentMessages,
    currentPageTitle: originPageTitle,
    currentNotebookName: originNotebookName,
    lastWrittenPageTitle: stickyTarget?.pageTitle,
    lastAssistantAction,
  };
}
