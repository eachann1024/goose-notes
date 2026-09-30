import type { PrivateInlineTarget } from "@/lib/notebook-ai/inlineMarkdownApplySelection";
import type { InlineMenuState } from "./inlineRewriteSession";

export type PageInlineState = InlineMenuState;
export type RewritePart = (markdown: string, prompt: string, signal: AbortSignal, update: (text: string) => void) => Promise<string>;

/** Only in-memory text and snapshots. A session never owns an editor or its lifecycle. */
export function createPageInlineRewriteSession(pageId: string) {
  let state: PageInlineState = "closed";
  let target: PrivateInlineTarget | undefined;
  let drafts: string[] = [];
  let generation = 0;
  let controller: AbortController | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: PageInlineState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const cancel = () => { generation++; controller?.abort(); controller = undefined; };
  const close = () => { cancel(); target = undefined; drafts = []; publish("closed"); };
  return {
    pageId,
    get state() { return state; },
    get target() { return target; },
    get drafts() { return drafts; },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    open(next: PrivateInlineTarget) {
      cancel();
      target = next;
      drafts = [];
      publish({ blockId: next.sourceBlockIds[0], status: "user-input", prompt: "", draft: "", ticker: "" });
    },
    close,
    setInput(input: string) {
      if (state !== "closed") publish({ ...state, input });
    },
    stop() {
      cancel();
      drafts = [];
      if (state !== "closed") publish({ ...state, status: "user-input", ticker: "", draft: "", error: undefined });
    },
    fail(error: unknown, blockId?: string) {
      cancel();
      publish({ blockId: blockId ?? (state === "closed" ? "" : state.blockId),
        prompt: state === "closed" ? "" : state.prompt, draft: "", ticker: "", status: "error", error });
    },
    async submit(prompt: string, rewrite: RewritePart) {
      if (!target || state === "closed" || !prompt.trim()) return;
      cancel();
      const request = generation;
      const captured = target;
      const abort = new AbortController();
      controller = abort;
      drafts = [];
      const pending = { blockId: captured.sourceBlockIds[0], prompt, input: "", draft: "", ticker: "", error: undefined };
      const owns = () => generation === request && !abort.signal.aborted && target === captured;
      publish({ ...pending, status: "thinking" });
      try {
        const results: string[] = [];
        for (const [index, part] of captured.parts.entries()) {
          if (!owns()) return;
          const prefix = captured.parts.length > 1 ? `${index + 1}/${captured.parts.length} · ` : "";
          publish({ ...pending, status: "thinking", ticker: `${prefix}正在生成建议` });
          const result = await rewrite(part.oldMarkdown, prompt, abort.signal, (ticker) => {
            if (owns()) publish({ ...pending, status: "thinking", ticker: prefix + ticker });
          });
          if (!owns()) return;
          if (!result.trim()) throw new Error("AI 未返回可写入的内容。");
          results.push(result);
        }
        if (!owns()) return;
        drafts = results;
        publish({ ...pending, status: "user-reviewing", draft: results.join("\n\n") });
      } catch (error) {
        if (owns()) publish({ ...pending, status: "error", error });
      } finally {
        if (controller === abort) controller = undefined;
      }
    },
  };
}
export type PageInlineRewriteSession = ReturnType<typeof createPageInlineRewriteSession>;
const sessions = new Map<string, PageInlineRewriteSession>();
export function getPageInlineRewriteSession(pageId: string): PageInlineRewriteSession {
  let session = sessions.get(pageId);
  if (!session) {
    session = createPageInlineRewriteSession(pageId);
    sessions.set(pageId, session);
  }
  return session;
}
