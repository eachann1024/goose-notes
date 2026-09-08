/* eslint-disable react-hooks/globals, react-refresh/only-export-components */
import assert from "node:assert/strict";
import { act, createElement, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import type { UIMessage } from "ai";
import { installExportDom } from "./installExportDom";
import type { NotebookAiMessage } from "../../src/lib/notebook-ai/types";
import { useNotebookAiChats } from "../../src/stores/useNotebookAiChats";
import {
  NotebookAiSessionProvider,
  useNotebookAiSession,
} from "../../src/pages/workspace/components/notebook-ai/NotebookAiSession";
import { useChat, type UseChatHelpers } from "@ai-sdk/react";

installExportDom();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type MockChatState = {
  id: string;
  messages: NotebookAiMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
};

/**
 * 模拟 @ai-sdk/react 的关键语义：旧 Chat 完成时会读取最新 render 的 onFinish。
 * 因而旧实现会把 A 的 finishedMessages 交给 B 闭包；本行为用例直接走该路径。
 */
function createMockUseChat() {
  let currentId = "";
  let updateCurrent: ((update: (previous: MockChatState) => MockChatState) => void) | null = null;
  let latestOnFinish:
    | ((event: { messages: NotebookAiMessage[] }) => void)
    | undefined;

  const useMockChat: typeof useChat = <
    UI_MESSAGE extends UIMessage = UIMessage,
  >(
    options = {},
  ) => {
    const id = options.id ?? "mock-chat";
    const [state, setState] = useState<MockChatState>(() => ({
      id,
      messages: (options.messages ?? []) as NotebookAiMessage[],
      status: "ready",
    }));
    if (state.id !== id) {
      setState({
        id,
        messages: (options.messages ?? []) as NotebookAiMessage[],
        status: "ready",
      });
    }
    currentId = id;
    updateCurrent = (update) => setState(update);
    latestOnFinish = options.onFinish as typeof latestOnFinish;

    const setMessages = useCallback(
      (
        next:
          | UI_MESSAGE[]
          | ((messages: UI_MESSAGE[]) => UI_MESSAGE[]),
      ) => {
        setState((previous) => ({
          ...previous,
          messages:
            typeof next === "function"
              ? (next(previous.messages as UI_MESSAGE[]) as NotebookAiMessage[])
              : (next as NotebookAiMessage[]),
        }));
      },
      [],
    );
    const stop = useCallback(() => {}, []);
    const clearError = useCallback(() => {}, []);
    const sendMessage = useCallback(async () => {}, []);

    return {
      id: state.id,
      messages: state.messages as UI_MESSAGE[],
      status: state.status,
      error: undefined,
      setMessages,
      stop,
      clearError,
      sendMessage,
      regenerate: async () => {},
      resumeStream: async () => {},
      addToolResult: async () => {},
      addToolOutput: async () => {},
      addToolApprovalResponse: async () => {},
    } as unknown as UseChatHelpers<UI_MESSAGE>;
  };

  return {
    useMockChat,
    start(id: string) {
      if (currentId !== id || !updateCurrent) return;
      updateCurrent((previous) => ({ ...previous, status: "streaming" }));
    },
    completeCurrent(id: string, messages: NotebookAiMessage[]) {
      if (currentId !== id || !updateCurrent) return;
      updateCurrent((previous) => ({
        ...previous,
        messages,
        status: "ready",
      }));
    },
    completeOldChat(messages: NotebookAiMessage[]) {
      latestOnFinish?.({ messages });
    },
  };
}

function message(id: string, text: string): NotebookAiMessage {
  return {
    id,
    role: "assistant",
    parts: [{ type: "text", text }],
  } as NotebookAiMessage;
}

function SessionProbe() {
  const session = useNotebookAiSession();
  return createElement(
    "output",
    { id: "session-probe" },
    JSON.stringify({
      notebookId: session.notebookId,
      conversationId: session.conversationId,
      messages: session.messages.map((item) => item.id),
    }),
  );
}

async function run() {
  useNotebookAiChats.setState({ chats: {}, composerDrafts: {} });
  const mock = createMockUseChat();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const render = async (notebookId: string) => {
    await act(async () => {
      root.render(
        createElement(
          NotebookAiSessionProvider,
          { notebookId, useChatHook: mock.useMockChat },
          createElement(SessionProbe),
        ),
      );
    });
  };

  try {
    await render("notebook-a");
    const conversationA = useNotebookAiChats
      .getState()
      .getActiveConversationId("notebook-a");
    assert.ok(conversationA);

    await render("notebook-b");
    const conversationB = useNotebookAiChats
      .getState()
      .getActiveConversationId("notebook-b");
    assert.ok(conversationB);
    const chatB = `notebook-ai-notebook-b-${conversationB}`;

    // 复现 SDK 的旧 Chat 经 latest onFinish 转发：此处不应再有 callback 可写 B。
    await act(async () => {
      mock.completeOldChat([message("late-a", "A 的迟到回复")]);
    });
    assert.match(
      host.querySelector("#session-probe")?.textContent ?? "",
      /"notebookId":"notebook-b"/,
    );
    assert.doesNotMatch(
      host.querySelector("#session-probe")?.textContent ?? "",
      /late-a/,
    );
    assert.deepEqual(
      useNotebookAiChats
        .getState()
        .getConversationMessages("notebook-b", conversationB),
      [],
    );

    await act(async () => {
      mock.start(chatB);
    });
    await act(async () => {
      mock.completeCurrent(chatB, [message("done-b", "B 的正常回复")]);
    });
    await new Promise((resolve) => setTimeout(resolve, 80));

    assert.match(
      host.querySelector("#session-probe")?.textContent ?? "",
      /done-b/,
    );
    assert.deepEqual(
      useNotebookAiChats
        .getState()
        .getConversationMessages("notebook-b", conversationB)
        .map((item) => item.id),
      ["done-b"],
    );
    assert.deepEqual(
      useNotebookAiChats
        .getState()
        .getConversationMessages("notebook-a", conversationA),
      [],
    );
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
}

await run();
console.log("notebook AI session notebook-switch behavior passed");
process.exit(0);
