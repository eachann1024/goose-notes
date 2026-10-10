import type {
  AiComposerPayload,
  AiFileReferenceAttrs,
  AiReferenceSuggestionItem,
} from "@/components/editor/ai/composer/referenceLookup";
import type { AiSelectionQuoteAttrs } from "@/components/editor/ai/composer/selectionQuote";
import type { JSONContent } from "@/types";
import type { ComposerSlashBuiltinId } from "@/lib/notebook-ai/composerSlashCommands";
export interface NotebookAiImageAttachment {
  file: File;
  previewUrl: string;
}

export interface ComposerHandle {
  /** 聚焦输入框 */
  focus: () => void;
  /** 打开面板后立即给输入框植入初始引用（当前页上下文） */
  insertReference: (reference: AiFileReferenceAttrs) => void;
  /** 空会话默认 @ 仍可替换时，改成最新当前页 */
  replaceDefaultPageReference: (
    reference: AiFileReferenceAttrs,
  ) => "applied" | "already" | "skipped";
  /** 把选区引用 chip 追加到输入框末尾；加入对话路径由外层聚焦 */
  appendSelectionQuote: (
    quote: AiSelectionQuoteAttrs,
    options?: { restoreCaret?: boolean; animate?: boolean },
  ) => "appended" | "duplicate" | "skipped";
}

export interface ComposerProps {
  /** 用于按笔记本持久化输入草稿 */
  notebookId: string;
  /** 当前会话；切换会话时推迟消费加入对话队列 */
  conversationId?: string;
  /** 面板解析后的初始草稿；不传则读 store */
  initialContent?: JSONContent | null;
  onSend: (
    payload: AiComposerPayload,
    images: NotebookAiImageAttachment[],
  ) => boolean | void;
  onSlashCommand?: (id: ComposerSlashBuiltinId) => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  searchPages?: (query: string) => AiReferenceSuggestionItem[];
  onEscape?: () => void;
  /** 全屏时输入区居中加宽 */
  layout?: "side-panel" | "fullscreen";
}
