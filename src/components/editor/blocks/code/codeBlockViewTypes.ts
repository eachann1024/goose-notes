import { useCodeBlockEdit } from "./useCodeBlockEdit";
import { useCodePreview } from "./useCodePreview";

export type CodeBlockEditState = ReturnType<typeof useCodeBlockEdit>;
export type CodeBlockPreviewState = ReturnType<typeof useCodePreview>;
export interface CodeBlockViewProps {
  block: any;
  contentRef: any;
  editor: any;
  language: string;
  wrap: boolean;
  collapsed: boolean;
  summary: string;
  isEditable: boolean;
  edit: CodeBlockEditState;
  preview: CodeBlockPreviewState;
}
