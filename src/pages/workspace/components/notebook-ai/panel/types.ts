import type { RefObject } from "react";
import type { EditorRef } from "@/components/editor/core/Editor";
import type {
  NotebookAiLayoutMode,
  NotebookAiPanelSelectionCapture,
} from "../useNotebookAiPanel";
export interface NotebookAiPanelProps {
  notebookId: string;
  onClose: () => void;
  editorRef?: RefObject<EditorRef | null>;
  capturedSelection?: NotebookAiPanelSelectionCapture | null;
  onConsumeCapturedSelection?: () => void;
  /** 打开方式：侧栏并排 / 全屏 */
  layoutMode?: NotebookAiLayoutMode;
  onLayoutModeChange?: (mode: NotebookAiLayoutMode) => void;
  /** 侧栏可拖宽；全屏铺满主区域 */
  variant?: "side-panel" | "fullscreen";
}
