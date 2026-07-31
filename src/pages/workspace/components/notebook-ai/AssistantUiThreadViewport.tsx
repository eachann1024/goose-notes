/**
 * assistant-ui 的只读线程适配层。
 *
 * NotebookAiSession/useChat 仍是唯一消息真源；这里仅把同一份消息投影给
 * assistant-ui runtime，以复用 ThreadPrimitive 的滚动和视口行为。
 */
import type { ReactNode } from "react";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import type { NotebookAiMessage } from "@/lib/notebook-ai/types";

interface AssistantUiThreadViewportProps {
  messages: NotebookAiMessage[];
  isRunning: boolean;
  className?: string;
  children: ReactNode;
}

function convertNotebookAiMessage(
  message: NotebookAiMessage,
): ThreadMessageLike {
  const content = (message.parts ?? [])
    .filter(
      (part): part is Extract<typeof part, { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => ({ type: "text" as const, text: part.text }));

  return {
    id: message.id,
    role: message.role,
    content,
  };
}

/**
 * 只读使用 ExternalStoreRuntime：不接管发送、工具调用或持久化。
 */
export function AssistantUiThreadViewport({
  messages,
  isRunning,
  className,
  children,
}: AssistantUiThreadViewportProps) {
  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    isDisabled: true,
    convertMessage: convertNotebookAiMessage,
    onNew: async () => {},
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
        <ThreadPrimitive.Viewport
          autoScroll
          turnAnchor="bottom"
          className={className}
        >
          {children}
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
