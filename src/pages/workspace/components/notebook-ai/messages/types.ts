import type { RefObject } from "react";
import type { NotebookAiMessage } from "@/lib/notebook-ai/types";
import type { EditorRef } from "@/components/editor/core/Editor";
import type {
  BatchApprovalResponse,
  BatchUndoResult,
} from "../ApprovalPlanCard";
export interface ChatMessagesProps {
  messages: NotebookAiMessage[];
  /** 正在流式输出的消息 id（最后一条 assistant msg id）*/
  streamingMessageId?: string;
  editorRef?: RefObject<EditorRef | null>;
  /** 全屏会话更宽、居中；侧栏保持紧凑 */
  layout?: "side-panel" | "fullscreen";
  onEmptySuggestion?: (text: string) => void;
  onBatchApproval: (response: BatchApprovalResponse) => Promise<void> | void;
  onBatchUndo: (toolCallId: string, runId: string) => Promise<BatchUndoResult>;
}
