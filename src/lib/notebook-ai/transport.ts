import { DirectChatTransport } from "ai";
import { buildNotebookAgent } from "./agent";
import type { notebookAiTools } from "./tools";
import type { UIMessage } from "ai";

export type NotebookChatUIMessage = UIMessage<
  unknown,
  never,
  {
    [K in keyof typeof notebookAiTools]: (typeof notebookAiTools)[K] extends {
      inputSchema: infer S;
      execute: (...args: any[]) => Promise<infer O>;
    }
      ? { input: S extends { parse: (v: any) => infer I } ? I : unknown; output: O }
      : never;
  }
>;

export type BuildTransportResult =
  | {
      ok: true;
      transport: DirectChatTransport<never, typeof notebookAiTools>;
    }
  | { ok: false; reason: string };

/**
 * 构建绑定指定笔记本的 DirectChatTransport。
 * 每次调用都会重新构建以保证 agent 中的 system prompt 是最新的。
 */
export function buildTransport(notebookId: string): BuildTransportResult {
  const agentResult = buildNotebookAgent(notebookId);
  if (!agentResult.ok) {
    return { ok: false, reason: agentResult.reason };
  }

  const transport = new DirectChatTransport({
    agent: agentResult.agent,
  });

  return { ok: true, transport };
}
