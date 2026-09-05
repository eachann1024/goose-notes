/**
 * AI 输入框的对外 handle、props 与原生事件表。
 * 被 AiComposerInput、useComposerEditor 使用。
 * 依赖 referenceLookup 类型与 JSONContent。
 */
import type { JSONContent } from "@/types";
import type {
 AiComposerPayload,
 AiFileReferenceAttrs,
 AiReferenceSuggestionItem,
} from "./referenceLookup";
import type { AiSelectionQuoteAttrs } from "./selectionQuote";
import type { ComposerSlashBuiltinId } from "@/lib/notebook-ai/composerSlashCommands";

export interface AiComposerInputHandle {
 focus: () => void;
 /** 暴露命令式 contenteditable 节点，供外层量内容宽度（只读，勿改样式） */
 getEditorEl: () => HTMLDivElement | null;
 clear: () => void;
 getPayload: () => AiComposerPayload;
 /** 解析 payload 中的内联图片 token → 真实 File 附件，按出现顺序 */
 resolveImages: (
  payload: AiComposerPayload,
 ) => { file: File; previewUrl: string }[];
 /** 在光标处插入图片 chip（无光标时追加到末尾） */
 insertImages: (files: File[]) => void;
 /** 在光标处插入页面引用 chip（无光标时追加到末尾） */
 insertReference: (reference: AiFileReferenceAttrs) => void;
 /**
  * 把选区引用 chip 静默追加到输入框末尾。
  * 不 focus；restoreCaret 为 true 时恢复插入前的 caret。
  */
 appendSelectionQuote: (
  quote: AiSelectionQuoteAttrs,
  options?: { restoreCaret?: boolean; animate?: boolean },
 ) => "appended" | "duplicate" | "skipped";
 /**
  * 空会话默认 @ 当前页：输入区仍是「空 / 仅一条文件引用」时替换为最新页。
  * 用户已打字或加入其他 chip 时跳过。
  */
 replaceDefaultPageReference: (
  reference: AiFileReferenceAttrs,
 ) => "applied" | "already" | "skipped";
}

export interface AiComposerInputProps {
 placeholder: string;
 placeholderOverlayText?: string;
 autoFocusToken: number;
 onSubmit: () => void;
 onEscape: () => void;
 initialContent?: JSONContent | null;
 onContentChange?: (content: JSONContent | null) => void;
 onIsEmptyChange?: (isEmpty: boolean) => void;
 /** panel 变体输入区超过一行时回调，用于外壳圆角切换 */
 onMultilineChange?: (multiline: boolean) => void;
 /** 每次量高后回调（含未跨行），供外层重算单行/两行 chrome 布局 */
 onLayoutMeasure?: () => void;
 /** 外层布局类：默认 flex-1；两行展开时传 order-first w-full basis-full */
 className?: string;
 onReferenceAdded?: (reference: AiFileReferenceAttrs) => void;
 searchPages?: (query: string) => AiReferenceSuggestionItem[];
 referencePlacement?: "inline" | "external";
 variant?: "compact" | "panel";
 compactWidthClass?: string;
 disabled?: boolean;
 /** 单张图片最大字节数，超出触发 onImageRejected */
 maxImageBytes?: number;
 /** 输入框内最多同时存在的图片数量，超出触发 onImageRejected */
 maxImageCount?: number;
 onImageRejected?: (message: string) => void;
 notebookId?: string;
 /** 选择或发送 /新会话、/压缩 等内置指令 */
 onSlashCommand?: (id: ComposerSlashBuiltinId) => void;
}

export interface ComposerNativeHandlers {
 onBeforeInput: (event: Event) => void;
 onInput: (event: Event) => void;
 onKeyDown: (event: KeyboardEvent) => void;
 onClick: (event: MouseEvent) => void;
 onMouseOver: (event: MouseEvent) => void;
 onMouseOut: (event: MouseEvent) => void;
 onPaste: (event: ClipboardEvent) => void;
 onBlur: () => void;
 onCompositionStart: () => void;
 onCompositionEnd: () => void;
}
