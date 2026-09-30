/** 从各类流式事件里抽出思考增量，避免只认 OpenAI 摘要字段。 */

function nestedText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.text === "string") return record.text;
  if (typeof record.content === "string") return record.content;
  return "";
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value) return value;
    const nested = nestedText(value);
    if (nested) return nested;
  }
  return "";
}

export function reasoningDeltaFromChatChoice(delta: unknown): string {
  if (!delta || typeof delta !== "object") return "";
  const record = delta as Record<string, unknown>;
  return firstNonEmpty(
    record.reasoning_content,
    record.reasoning,
    record.thinking,
  );
}

export function reasoningDeltaFromResponsesEvent(event: unknown): string {
  if (!event || typeof event !== "object") return "";
  const record = event as Record<string, unknown>;
  const type = String(record.type ?? "");
  if (
    type !== "response.reasoning_text.delta" &&
    type !== "response.reasoning_summary_text.delta"
  ) {
    return "";
  }
  return firstNonEmpty(record.delta);
}
