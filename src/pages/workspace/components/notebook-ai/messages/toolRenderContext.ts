import { createContext, type RefObject } from "react";
import type { EditorRef } from "@/components/editor/core/Editor";
import type {
  BatchApprovalResponse,
  BatchUndoResult,
} from "../ApprovalPlanCard";
export interface AssistantToolRenderContextValue {
  isStreaming: boolean;
  editorRef?: RefObject<EditorRef | null>;
  onBatchApproval: (response: BatchApprovalResponse) => Promise<void> | void;
  onBatchUndo: (toolCallId: string, runId: string) => Promise<BatchUndoResult>;
}

export const AssistantToolRenderContext =
  createContext<AssistantToolRenderContextValue | null>(null);
