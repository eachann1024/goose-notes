import type { RefObject } from "react";
import type { ComposerImageRegistry } from "./composerImageChip";
import type { ImageDedupTracker } from "./imageDedup";

export interface ComposerImagesOptions {
  editorRef: RefObject<HTMLDivElement | null>;
  imageRegistryRef: RefObject<ComposerImageRegistry>;
  imageDedupRef: RefObject<ImageDedupTracker>;
  imagePreviewElRef: RefObject<HTMLDivElement | null>;
  imagePreviewHideTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
  activePreviewImageIdRef: RefObject<string | null>;
  activePreviewChipRef: RefObject<HTMLElement | null>;
  onContentMutation: () => void;
  maxImageBytes?: number;
  maxImageCount?: number;
  onImageRejected?: (message: string) => void;
}
