import type { BlockNoteEditor } from "@blocknote/core";
import type React from "react";

export interface ImageLightboxProps {
  editor: BlockNoteEditor<any, any, any>;
  editorContainerRef: React.RefObject<HTMLDivElement | null>;
  editable?: boolean;
}

export interface SlideInfo {
  src: string;
  alt?: string;
}
