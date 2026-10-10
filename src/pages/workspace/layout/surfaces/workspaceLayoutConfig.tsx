import { type RefObject } from "react";
import { type EditorRef } from "@/components/editor/core/Editor";
import { isElectronRuntime } from "@/lib/electron/runtime";

export // Electron 桌面端 chrome：全宽 overlay 顶栏挂在 .workspace-shell 顶部（覆盖侧栏+主区），
// 主区内不再重复渲染 PageHeader/HistoryToolbar。Electron 构建保持现状，一行不挪。
const isElectronChrome = isElectronRuntime();

export interface WorkspaceLayoutProps {
  isDragging: boolean;
  dragIntent: "folder" | "text-file" | "file";
  onDragEnter: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => Promise<void>;
  editorRef: RefObject<EditorRef | null>;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}
