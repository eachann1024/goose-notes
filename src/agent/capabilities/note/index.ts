import {
  buildAiContextBundle,
  buildAiWorkspaceUserPrompt,
  buildAiWritePlan,
  commitAiWritePlan,
  createAiChatOnlyTarget,
  resolveAiTargetIntent,
  resolveAiTargetSelection,
  resolveAiTargetReference,
  type AiResolvedTarget,
} from "@/lib/ai-write";
import { usePages } from "@/stores/usePages";
import type { Page } from "@/types";
import type {
  AgentArtifact,
  AgentCapabilityBuildArtifactParams,
  AgentCapabilityBuildPlanParams,
  AgentCapabilityManifest,
  AgentCommitHandler,
  AgentComposerToken,
  AgentInputContext,
  AgentParsedInput,
  AgentPlan,
  AgentPlanBuildResult,
} from "@/agent/core/types";

const WORKSPACE_NOTE_SYSTEM_PROMPT =
  "你是 Goose Note 内置 AI 助手。优先结合当前页面与用户 @ 引用的内容工作。若用户要写入页面，就直接输出可落文的最终 Markdown，不要解释，不要自我介绍。";

const INLINE_NOTE_SYSTEM_PROMPT =
  "你是 Goose Note 内置写作助手。输出必须直接可落文，不要解释，不要加前后缀，不要使用 Markdown 代码围栏。只输出最终文本。";

function buildInlinePrompt(params: {
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

function createPlan(params: {
  capabilityId: AgentPlan["capabilityId"];
  artifactType: AgentPlan["artifactType"];
  context: AgentInputContext;
  parsed: AgentParsedInput;
  promptText: string;
  systemPrompt: string;
  userPrompt: string;
  targetType: AgentPlan["targetType"];
}) {
  return {
    id: `agent-plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    capabilityId: params.capabilityId,
    artifactType: params.artifactType,
    executionStrategy: "single",
    surface: params.context.surface,
    promptText: params.promptText,
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
    intentReason: params.capabilityId,
    targetType: params.targetType,
    resolvedTarget: params.parsed.resolvedTarget,
    createdAt: Date.now(),
  } satisfies AgentPlan;
}

function createTargetErrorArtifact(message: string) {
  return {
    type: "text_response",
    text: message,
    error: true,
  } satisfies AgentArtifact;
}

function getTargetPage(
  resolvedTarget: AiResolvedTarget | undefined | null,
): Page | null {
  if (!resolvedTarget?.pageId) return null;
  return usePages.getState().pages[resolvedTarget.pageId] ?? null;
}

function validateWorkspaceWriteTarget(parsed: AgentParsedInput) {
  const { resolvedTarget, targetReference } = parsed;

  if (targetReference?.pageId) {
    const referencedPage = usePages.getState().pages[targetReference.pageId];
    if (!referencedPage) {
      return createTargetErrorArtifact("你指定的目标页不存在或尚未加载，暂时没法写入。");
    }
    if (referencedPage.localFilePath && referencedPage.localReadState === "error") {
      return createTargetErrorArtifact("你指定的目标页当前不可读取，暂时没法写入。");
    }
    if (referencedPage.isLocked) {
      return createTargetErrorArtifact("你指定的目标页已锁定，暂时不能改写。");
    }
  }

  if (resolvedTarget.action === "replace_page" || resolvedTarget.action === "append_page") {
    const page = getTargetPage(resolvedTarget);
    if (!page) {
      return createTargetErrorArtifact("目标页不存在或尚未加载，暂时没法写入。");
    }
    if (page.localFilePath && page.localReadState === "error") {
      return createTargetErrorArtifact("目标页当前不可读取，暂时没法写入。");
    }
    if (page.isLocked) {
      return createTargetErrorArtifact("目标页已锁定，暂时不能改写。");
    }
  }

  return null;
}

export function parseNoteAgentInput(context: AgentInputContext): AgentParsedInput {
  const targetRefMatch =
    context.surface === "workspace"
      ? resolveAiTargetReference(context.payload)
      : null;
  const resolvedTarget =
    context.surface === "workspace"
      ? resolveAiTargetIntent({
          payload: context.payload,
          selection: resolveAiTargetSelection({
            payload: context.payload,
            originPageId: context.originPageId,
            originNotebookId: context.originNotebookId,
          }),
          originPageId: context.originPageId,
          originNotebookId: context.originNotebookId,
        })
      : createAiChatOnlyTarget();

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
  };
}

function buildWorkspacePlan(
  params: AgentCapabilityBuildPlanParams,
): AgentPlanBuildResult {
  const { context, parsed, match } = params;
  const promptText = parsed.payload.promptText.trim();

  if (match.capabilityId !== "note.chat") {
    const validationArtifact = validateWorkspaceWriteTarget(parsed);
    if (validationArtifact) {
      return {
        intent: match,
        artifact: validationArtifact,
      };
    }
  }

  const contextBundle = buildAiContextBundle({
    payload: parsed.payload,
    resolvedTarget: parsed.resolvedTarget,
    originPageId: context.originPageId,
  });
  const userPrompt = buildAiWorkspaceUserPrompt({
    promptText,
    resolvedTarget: parsed.resolvedTarget,
    contextBundle,
  });

  return {
    intent: match,
    plan: createPlan({
      capabilityId: match.capabilityId,
      artifactType: match.artifactType,
      context,
      parsed,
      promptText,
      systemPrompt: WORKSPACE_NOTE_SYSTEM_PROMPT,
      userPrompt,
      targetType: parsed.resolvedTarget.mode,
    }),
  };
}

function buildInlinePlan(
  params: AgentCapabilityBuildPlanParams,
): AgentPlanBuildResult {
  const { context, parsed, match } = params;
  const promptText = parsed.payload.promptText.trim();
  const basePrompt = buildInlinePrompt({ context, parsed });
  const contextBundle = buildAiContextBundle({
    payload: parsed.payload,
    resolvedTarget: parsed.resolvedTarget,
  });
  const userPrompt = [
    basePrompt,
    contextBundle.referenceContextBlock
      ? `补充上下文：\n${contextBundle.referenceContextBlock}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!userPrompt) {
    return {
      intent: match,
      artifact: {
        type: "text_response",
        text: "",
      },
    };
  }

  return {
    intent: match,
    plan: createPlan({
      capabilityId: match.capabilityId,
      artifactType: match.artifactType,
      context,
      parsed,
      promptText,
      systemPrompt: INLINE_NOTE_SYSTEM_PROMPT,
      userPrompt,
      targetType: "inline_selection",
    }),
  };
}

function buildNoteArtifact(
  params: AgentCapabilityBuildArtifactParams,
): AgentArtifact {
  if (params.plan.artifactType === "markdown_note") {
    const writePlan = buildAiWritePlan({
      markdown: params.outputText,
      promptText: params.plan.promptText,
      resolvedTarget: params.parsed.resolvedTarget,
    });
    if (!writePlan) {
      return createTargetErrorArtifact("写入计划生成失败，请稍后再试。");
    }
    return {
      type: "markdown_note",
      plan: writePlan,
    };
  }

  return {
    type: "text_response",
    text: params.outputText.trim(),
  };
}

export const noteChatCapability: AgentCapabilityManifest = {
  id: "note.chat",
  label: "笔记聊天",
  surfaces: ["workspace", "inline"],
  outputArtifactTypes: ["text_response"],
  match: (context, parsed) => {
    if (context.surface === "inline") {
      return {
        capabilityId: "note.chat",
        artifactType: "text_response",
        targetType: "inline_selection",
        reason: "inline_chat",
      };
    }

    return parsed.resolvedTarget.action === "chat_only"
      ? {
          capabilityId: "note.chat",
          artifactType: "text_response",
          targetType: parsed.resolvedTarget.mode,
          reason: "workspace_chat",
        }
      : null;
  },
  buildPlan: (params) =>
    params.context.surface === "inline"
      ? buildInlinePlan(params)
      : buildWorkspacePlan(params),
  buildArtifact: buildNoteArtifact,
};

export const noteCreateCapability: AgentCapabilityManifest = {
  id: "note.create",
  label: "新建笔记",
  surfaces: ["workspace"],
  outputArtifactTypes: ["markdown_note"],
  match: (_context, parsed) =>
    parsed.resolvedTarget.action === "create_root_page" ||
    parsed.resolvedTarget.action === "create_child_page"
      ? {
          capabilityId: "note.create",
          artifactType: "markdown_note",
          targetType: parsed.resolvedTarget.mode,
          reason: "workspace_create",
        }
      : null,
  buildPlan: buildWorkspacePlan,
  buildArtifact: buildNoteArtifact,
};

export const noteReplaceCapability: AgentCapabilityManifest = {
  id: "note.replace",
  label: "改写笔记",
  surfaces: ["workspace"],
  outputArtifactTypes: ["markdown_note"],
  match: (_context, parsed) =>
    parsed.resolvedTarget.action === "replace_page"
      ? {
          capabilityId: "note.replace",
          artifactType: "markdown_note",
          targetType: parsed.resolvedTarget.mode,
          reason: "workspace_replace",
        }
      : null,
  buildPlan: buildWorkspacePlan,
  buildArtifact: buildNoteArtifact,
};

export const noteAppendCapability: AgentCapabilityManifest = {
  id: "note.append",
  label: "追加笔记",
  surfaces: ["workspace"],
  outputArtifactTypes: ["markdown_note"],
  match: (_context, parsed) =>
    parsed.resolvedTarget.action === "append_page"
      ? {
          capabilityId: "note.append",
          artifactType: "markdown_note",
          targetType: parsed.resolvedTarget.mode,
          reason: "workspace_append",
        }
      : null,
  buildPlan: buildWorkspacePlan,
  buildArtifact: buildNoteArtifact,
};

export const markdownNoteCommitHandler: AgentCommitHandler = {
  artifactType: "markdown_note",
  commit: async (artifact) => {
    if (artifact.type !== "markdown_note") return null;
    return await commitAiWritePlan(artifact.plan);
  },
};
