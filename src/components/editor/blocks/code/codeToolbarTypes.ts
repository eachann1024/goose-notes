export interface CodeBlockToolbarProps {
  language: string;
  onLanguageChange: (language: string) => void;
  getCodeContent: () => string;
  onFormat?: (formatted: string) => void;
  onWrapChange?: (wrap: boolean) => void;
  wrap?: boolean;
  editable?: boolean;
  previewMode?: "code" | "preview";
  onPreviewModeChange?: (mode: "code" | "preview") => void;
  onOpenPreview?: () => void;
  onSystemPreview?: () => void;
  onDownloadPreview?: () => void;
  /** 复制渲染后的预览图（Mermaid / Math），未提供时退回复制源码 */
  onCopyPreview?: () => void | Promise<void>;
  canPreview?: boolean;
}

export interface CodeCopyState {
  copied: boolean;
  copyingImage: boolean;
  handleCopy: () => Promise<void>;
}
