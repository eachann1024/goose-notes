/**
 * 行内 AI 忙态 ticker：固定一行高度，新内容盖住旧内容。
 * 优先展示思考/推理；没有思考时才用正在生成的正文，避免空转。
 */

export type InlineBusyTickerSource = {
  reasoningText?: string;
  text?: string;
};

export function resolveInlineBusyTicker(
  update: InlineBusyTickerSource,
): string {
  const reasoning = update.reasoningText ?? "";
  if (reasoning.trim()) return reasoning;
  return update.text ?? "";
}

/** 固定一行展示：只留最后一句，旧思考被新内容盖住。 */
export function visibleBusyTickerLine(text: string): string {
  const lastLine =
    text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1) ?? "";
  const lastSentence =
    lastLine
      .split(/(?<=[。！？!?])/)
      .map((part) => part.trim())
      .filter(Boolean)
      .at(-1) ?? lastLine;
  return lastSentence;
}
