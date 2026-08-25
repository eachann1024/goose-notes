/**
 * 内联图片 chip / hover 预览 portal 的命令式 DOM，以及注册表 GC。
 * 被 composerTokens、useComposerImages、AiComposerInput 使用。
 * 依赖 referenceLookup 的图片 attrs、imageDedup。
 */
import type { AiImageAttachmentAttrs } from "./referenceLookup";
import type { ImageDedupTracker } from "./imageDedup";

/**
 * 内联图片的实体：chip 只携带可序列化 attrs，
 * 真实 File / previewUrl 由每个 composer 实例的注册表维护。
 */
export interface ComposerImageEntry {
  file: File;
  previewUrl: string;
}

export type ComposerImageRegistry = Map<string, ComposerImageEntry>;

/** hover 预览关闭延迟：从 chip 移到浮层时不闪断 */
export const IMAGE_PREVIEW_HIDE_MS = 120;

export function parseImageChipAttrs(
  chip: HTMLElement,
): AiImageAttachmentAttrs | null {
  try {
    return JSON.parse(
      chip.dataset.aiImageAttrs ?? "",
    ) as AiImageAttachmentAttrs;
  } catch {
    return null;
  }
}

/** 从事件目标解析可预览的 image chip；落在移除按钮上则视为不可预览 */
export function getPreviewableImageChip(
  target: EventTarget | null,
): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  if (target.closest("[data-ai-image-remove]")) return null;
  return target.closest<HTMLElement>("[data-ai-image-attrs]");
}

export function createImagePreviewPortal(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "ai-composer-image-preview";
  el.dataset.aiImagePreviewPortal = "true";
  el.setAttribute("role", "img");
  el.setAttribute("aria-hidden", "true");
  el.style.display = "none";
  document.body.appendChild(el);
  return el;
}

export function positionImagePreview(preview: HTMLElement, chip: HTMLElement) {
  const rect = chip.getBoundingClientRect();
  const gap = 8;
  const pw = preview.offsetWidth;
  const ph = preview.offsetHeight;
  let left = rect.left + rect.width / 2 - pw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
  let top = rect.top - ph - gap;
  if (top < 8) {
    top = rect.bottom + gap;
  }
  if (top + ph > window.innerHeight - 8) {
    top = Math.max(8, window.innerHeight - ph - 8);
  }
  preview.style.left = `${Math.round(left)}px`;
  preview.style.top = `${Math.round(top)}px`;
}

export function createImageChipElement(
  attrs: AiImageAttachmentAttrs,
  registry: ComposerImageRegistry,
): HTMLSpanElement {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.dataset.aiImageAttrs = JSON.stringify(attrs);
  // 高度/行高/垂直对齐由 notebook-ai.css 与编辑器行高对齐；勿加 leading-none/h-*
  span.className =
    "ai-composer-chip inline-flex items-center justify-center gap-1 rounded text-[11px] font-medium" +
    " bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] border border-border" +
    " select-none";

  const entry = registry.get(attrs.imageId);
  if (entry) {
    // 有预览 URL 时 chip 可 hover 预览
    span.classList.add("cursor-pointer");
    span.dataset.aiImagePreviewable = "true";
    const img = document.createElement("img");
    img.src = entry.previewUrl;
    img.alt = "";
    img.draggable = false;
    img.className = "ai-composer-chip-thumb h-3.5 w-3.5 shrink-0 rounded-[3px] object-cover";
    span.appendChild(img);
  }

  const label = document.createElement("span");
  label.className = "max-w-[140px] truncate leading-none";
  label.textContent = attrs.fileName;
  span.appendChild(label);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.dataset.aiImageRemove = attrs.imageId;
  removeBtn.setAttribute("aria-label", `移除图片 ${attrs.fileName}`);
  removeBtn.title = `移除 ${attrs.fileName}`;
  removeBtn.className =
    "ai-composer-chip-remove ml-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] cursor-pointer" +
    " text-muted-foreground hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-foreground";
  removeBtn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  span.appendChild(removeBtn);

  return span;
}

export function createImageId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `img-${globalThis.crypto.randomUUID()}`;
  }
  return `img-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function gcStaleComposerImages(options: {
  liveIds: Set<string>;
  registry: ComposerImageRegistry;
  dedup: ImageDedupTracker;
  imagePreviewHideTimerRef: { current: ReturnType<typeof setTimeout> | null };
  activePreviewImageIdRef: { current: string | null };
  activePreviewChipRef: { current: HTMLElement | null };
  imagePreviewElRef: { current: HTMLDivElement | null };
}) {
  const activeId = options.activePreviewImageIdRef.current;
  // 被 GC 的图片若正在预览，直接关掉浮层（不依赖后方 hideImagePreview 声明顺序）
  if (activeId && !options.liveIds.has(activeId)) {
    if (options.imagePreviewHideTimerRef.current != null) {
      clearTimeout(options.imagePreviewHideTimerRef.current);
      options.imagePreviewHideTimerRef.current = null;
    }
    options.activePreviewImageIdRef.current = null;
    options.activePreviewChipRef.current = null;
    const preview = options.imagePreviewElRef.current;
    if (preview) {
      preview.style.display = "none";
      preview.replaceChildren();
      preview.setAttribute("aria-hidden", "true");
    }
  }
  options.registry.forEach((entry, imageId) => {
    if (options.liveIds.has(imageId)) return;
    URL.revokeObjectURL(entry.previewUrl);
    options.registry.delete(imageId);
    options.dedup.release(imageId);
  });
}

export function clearComposerImageRegistry(options: {
  registry: ComposerImageRegistry;
  dedup: ImageDedupTracker;
  imagePreviewHideTimerRef: { current: ReturnType<typeof setTimeout> | null };
  activePreviewImageIdRef: { current: string | null };
  activePreviewChipRef: { current: HTMLElement | null };
  imagePreviewElRef: { current: HTMLDivElement | null };
}) {
  if (options.imagePreviewHideTimerRef.current != null) {
    clearTimeout(options.imagePreviewHideTimerRef.current);
    options.imagePreviewHideTimerRef.current = null;
  }
  options.activePreviewImageIdRef.current = null;
  options.activePreviewChipRef.current = null;
  const preview = options.imagePreviewElRef.current;
  if (preview) {
    preview.style.display = "none";
    preview.replaceChildren();
    preview.setAttribute("aria-hidden", "true");
  }
  options.registry.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
  options.registry.clear();
  options.dedup.clear();
}
