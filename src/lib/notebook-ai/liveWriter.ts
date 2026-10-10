import type { ToolUIPart } from "ai";
import type { LiveWriterContext } from "./types";
import { usePages } from "@/stores/usePages";
import { guardPageForAiWrite } from "./pageWriteGuard";
import {
  sessions,
  stoppedToolCalls,
  THROTTLE_MS,
  tryExtractFromPartialJson,
  ensurePageCreated,
  writeIntermediateFrame,
  writeFinalFrame,
  reloadEditorIfActive,
  cleanupWriterSession,
} from "./liveWriterSession";
export {
  reloadEditorIfActive,
  createAndFinalizePage,
  cleanupWriterSession,
} from "./liveWriterSession";

export type StreamingWritePart = ToolUIPart & {
  type: "tool-createPage" | "tool-updatePage";
};

/**
 * 处理 createPage / updatePage 工具的流式 part。
 * 由 UI 层在每次 messages 更新时调用。
 *
 * @param part - 工具调用 part（类型为 tool-createPage 或 tool-updatePage）
 * @param ctx - 包含当前绑定笔记本 id 的上下文
 */
export async function handleStreamingWritePart(
  part: StreamingWritePart,
  ctx: LiveWriterContext,
): Promise<void> {
  const partData = part as unknown as {
    toolCallId: string;
    state: string;
    input?: unknown;
    output?: unknown;
  };
  const { toolCallId, state, input, output } = partData;
  const isCreatePage = part.type === "tool-createPage";

  // React 会在后续文本分片到达时重复传入已经完成的工具 part。
  // 终态只处理一次，避免同一个 updatePage 随每个文本分片重复刷新或落盘。
  if (stoppedToolCalls.has(toolCallId)) return;

  if (state.includes("error") || state.includes("denied")) {
    cleanupWriterSession(toolCallId);
    return;
  }

  if (state === "input-streaming") {
    const { title, markdown } = tryExtractFromPartialJson(input);

    if (!title) return; // title 还没流出来，等下一帧

    // 只有当 markdown 字段已出现（说明 title 的 JSON 字符串已闭合），才建页
    // 防止截断标题建页（bug 2 fix）：title 在 markdown 字段出现之前可能还未完整
    if (isCreatePage && !sessions.has(toolCallId)) {
      if (markdown === undefined) return; // title 还未完整，继续等
      await ensurePageCreated(title, ctx.notebookId, toolCallId);
    }

    const session = sessions.get(toolCallId);
    if (!session) return;

    const frameGuard = guardPageForAiWrite(session.pageId, {
      expectedNotebookId: session.notebookId,
    });
    if (!frameGuard.ok) {
      cleanupWriterSession(toolCallId);
      return;
    }

    // updatePage 的 markdown 可能因为工具调用修复/兜底暂时缺失；
    // 缺正文时不能写空帧，否则会把当前页清空。
    if (!isCreatePage && markdown === undefined) return;
    session.lastMarkdown = markdown ?? "";

    // 节流调度写入
    const now = Date.now();
    if (now - session.lastScheduled < THROTTLE_MS) {
      // 已有定时器在跑，更新 markdown 数据后等定时器触发
      return;
    }

    session.lastScheduled = now;
    if (session.throttleTimer) {
      clearTimeout(session.throttleTimer);
    }
    session.throttleTimer = setTimeout(() => {
      const s = sessions.get(toolCallId);
      if (!s) return;
      if (!writeIntermediateFrame(s)) {
        cleanupWriterSession(toolCallId);
        return;
      }
      s.throttleTimer = null;
    }, THROTTLE_MS);
  } else if (state === "output-available") {
    // 最终落盘
    // 清理定时器
    const session = sessions.get(toolCallId);
    // createPage 的 output 只有在 execute 完成后才应到达；若 UI 事件乱序且当前
    // 没有 session，不要抢先把 toolCallId 标成 stopped，正式 execute 仍需建页。
    if (isCreatePage && !session) return;
    if (session?.throttleTimer) {
      clearTimeout(session.throttleTimer);
      session.throttleTimer = null;
    }

    try {
      // output-available 时 input 已完整，从 input 取 markdown
      const { title: inputTitle, markdown: inputMarkdown } =
        tryExtractFromPartialJson(input);

      if (isCreatePage) {
        // createPage：优先使用 session（liveWriter 已建的页面）中的 pageId
        // execute() 会通过 registry 拿同一个 pageId，不会再建第二页
        const pageId = session?.pageId ?? null;
        if (!pageId) return;

        const md = inputMarkdown ?? "";
        // 用最终完整 title（input 已完整），确保标题与模型输出一致
        const title = inputTitle ?? session?.title ?? "";
        // 若最终 title 与建页时不同，writeFinalFrame 里 buildPageContent 会用最新 title 覆盖
        if (session) await writeFinalFrame(md, title, session);
      } else {
        // updatePage.execute 已经完成最终落盘；UI 层只负责刷新一次活动编辑器。
        // 不能在这里再次写入，否则最终回复的每个文本分片都会重复保存整篇页面。
        const pageId =
          input && typeof input === "object"
            ? ((input as Record<string, unknown>).pageId as string | undefined)
            : undefined;
        const targetPageId =
          pageId ?? ctx.currentPageId ?? usePages.getState().activePageId;
        if (!targetPageId) return;
        const result =
          output && typeof output === "object"
            ? (output as Record<string, unknown>)
            : null;
        if (result?.ok === true) reloadEditorIfActive(targetPageId);
      }
    } finally {
      cleanupWriterSession(toolCallId);
    }
  }
}
