import type { AgentArtifact, AgentPlan, MarkdownNoteArtifact } from "@/agent/core/types";
import type { AIStreamPhase } from "@/lib/ai-provider";
import type { AiWritePlan } from "@/lib/ai-write";
import type { AiSessionMessage } from "@/stores/useAiSessions";

export interface AiConversationMessage extends AiSessionMessage {
  streaming?: boolean;
}

export const STREAM_PHASE_LABEL: Record<AIStreamPhase, string> = {
  connecting: "正在连接模型",
  thinking: "正在整理上下文",
  generating: "正在生成回答",
  finishing: "正在整理结果",
};

export function genSessionId() {
  return `ai-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function extractSessionTitle(messages: AiConversationMessage[]) {
  const first = messages.find((m) => m.role === "user");
  if (!first?.text) return "新对话";
  return first.text.length > 40 ? `${first.text.slice(0, 40)}…` : first.text;
}

export function normalizeMessagesForPersistence(
  messages: AiConversationMessage[],
  streamPhase: AIStreamPhase,
) {
  return messages.map(({
    id,
    role,
    text,
    references,
    error,
    streaming,
    agentPlan,
    artifact,
    writePlan,
    versions,
    activeVersionIndex,
  }) => ({
    id,
    role,
    text: text || (streaming ? STREAM_PHASE_LABEL[streamPhase] : ""),
    references,
    error,
    agentPlan,
    artifact,
    writePlan:
      artifact?.type === "markdown_note"
        ? artifact.plan
        : writePlan,
    ...(versions ? { versions } : {}),
    ...(activeVersionIndex != null ? { activeVersionIndex } : {}),
  }));
}

export function legacyWritePlanToAgentPlan(writePlan: AiWritePlan | null | undefined): AgentPlan | null {
  if (!writePlan) return null;
  const capabilityId =
    writePlan.action === "append_page"
      ? "note.append"
      : writePlan.action === "replace_page" ||
          writePlan.action === "replace_block_range"
        ? "note.replace"
        : "note.create";
  return {
    id: `legacy-plan-${writePlan.action}-${writePlan.previewTitle}`,
    capabilityId,
    artifactType: "markdown_note",
    executionStrategy: "single",
    surface: "workspace",
    promptText: writePlan.promptText,
    systemPrompt: "",
    userPrompt: "",
    intentReason: "legacy_write_plan",
    targetType: writePlan.target.mode,
    resolvedTarget: writePlan.target,
    createdAt: Date.now(),
  };
}

export function legacyWritePlanToArtifact(writePlan: AiWritePlan | null | undefined): AgentArtifact | null {
  if (!writePlan) return null;
  return {
    type: "markdown_note",
    plan: writePlan,
  } as MarkdownNoteArtifact;
}

export function normalizeConversationMessage<T extends AiConversationMessage>(message: T): T {
  const artifact = message.artifact ?? legacyWritePlanToArtifact(message.writePlan);
  const agentPlan = message.agentPlan ?? legacyWritePlanToAgentPlan(message.writePlan);

  let text = message.text;
  if (artifact?.type === "text_response") {
    text = typeof artifact.text === "string" ? artifact.text : "";
  } else {
    text = typeof message.text === "string" ? message.text : "";
  }

  return {
    ...message,
    text,
    agentPlan,
    artifact,
    writePlan:
      artifact?.type === "markdown_note"
        ? artifact.plan
        : message.writePlan,
  };
}

export function getLastAgentPlan(messages: AiConversationMessage[]) {
  return (
    messages
      .map((message) => message.agentPlan)
      .filter(Boolean)
      .at(-1) ?? null
  );
}

export function getLastArtifact(messages: AiConversationMessage[]) {
  return (
    messages
      .map((message) => message.artifact)
      .filter(Boolean)
      .at(-1) ?? null
  );
}
