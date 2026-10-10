import type { RefObject } from "react";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
export type EditorComposerProps = {
  editor: any;
  editable: boolean;
  page: any;
  editorContainerRef: RefObject<HTMLDivElement | null>;
  handleEditorBlankMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleEditorPasteCapture: (
    event: React.ClipboardEvent<HTMLDivElement>,
  ) => void;
  getSlashItems: (query: string) => Promise<any[]>;
  pageIdForUpdateRef: RefObject<string | null>;
  syncedContentSignatureRef: RefObject<string | null>;
  pendingEditorChangeRef: RefObject<boolean>;
  debouncedUpdate: ((id: string) => void) & { cancel: () => void };
  /** 自上次程序化同步（切页/外部重载）以来用户是否真实交互过（见 Editor.tsx 意图门控）。 */
  userInteractedRef: RefObject<boolean>;
  /** 静默同步 store（不标脏、不入保存队列）：用于编辑器初始化后的异步 props 补全。 */
  silentContentSync: (content: BlockNoteContent) => void;
  isEditorFullWidth: boolean;
  effectiveTheme: "light" | "dark";
  searchProviders: any[];
  customActions: any[];
  /** 是否渲染块侧边菜单（+ / ⋮⋮）；紧凑布局可关闭。 */
  showSideMenu?: boolean;
  /**
   * 为 true 时强制隐藏格式化工具栏（仅在空白区域 mousedown 期间短暂置 true 用于消闪，
   * 由 Editor.tsx 的空白点击处理器管理）。
   */
  suppressFormattingToolbar?: boolean;
  usesRawEditorContent: boolean;
};
