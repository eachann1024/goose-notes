import type { NotebookAiMessage } from "@/lib/notebook-ai/types";
import type { AiComposerPayload } from "@/components/editor/ai/composer/referenceLookup";
import type { NotebookAiPanelSelectionCapture } from "../useNotebookAiPanel";
import type { NotebookAiImageAttachment } from "../Composer";
import type {
  BatchApprovalResponse,
  BatchUndoResult,
} from "../ApprovalPlanCard";
import type { getNotebookAiReferenceSuggestions } from "@/lib/notebook-ai/context";
export interface NotebookAiSessionValue {
  notebookId: string;
  conversationId: string;
  messages: NotebookAiMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  error: Error | undefined;
  clearError: () => void;
  stop: () => void;
  isStreaming: boolean;
  isBusy: boolean;
  unavailableReason: string | undefined;
  placeholderIndex: number;
  composerRevision: number;
  /** 用户显式新建空白会话后，不要再种默认 @ 当前页 */
  suppressDefaultPageSeed: boolean;
  send: (
    payload: AiComposerPayload,
    imageAttachments: NotebookAiImageAttachment[],
    options?: {
      capturedSelection?: NotebookAiPanelSelectionCapture | null;
      onConsumeCapturedSelection?: () => void;
    },
  ) => boolean;
  newConversation: (options?: {
    onConsumeCapturedSelection?: () => void;
  }) => void;
  /**
   * 打开 AI / 加入对话时解析当前会话：过期则归档并进入空白新会话。
   * 流式生成中不切换，避免打断正在进行的回复。
   */
  ensureFreshConversation: () => string;
  compactConversation: () => void;
  selectConversation: (
    nextConversationId: string,
    options?: { onConsumeCapturedSelection?: () => void },
  ) => void;
  /** 删除历史会话；流式生成中拒绝。返回是否已执行删除 */
  deleteConversation: (targetConversationId: string) => boolean;
  searchPages: (
    query: string,
  ) => ReturnType<typeof getNotebookAiReferenceSuggestions>;
  onBatchApproval: (response: BatchApprovalResponse) => Promise<void>;
  onBatchUndo: (toolCallId: string, runId: string) => Promise<BatchUndoResult>;
}

export interface NotebookAiSessionScope {
  notebookId: string;
  conversationId: string;
  generation: number;
}
