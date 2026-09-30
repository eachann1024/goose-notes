/**
 * 命令式挂载 contenteditable：生命周期内不销毁，避免 React 改属性。
 * 被 AiComposerInput 在原生 handler 赋值之后调用。
 * 依赖 composerTokens、图片 preview portal、宿主空壳 ref。
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { flushSync } from "react-dom";
import type { JSONContent } from "@/types";
import {
  createImagePreviewPortal,
  IMAGE_PREVIEW_HIDE_MS,
  type ComposerImageRegistry,
} from "./composerImageChip";
import {
  buildPayloadFromTokens,
  isComposerPayloadEmpty,
  readTokensFromDom,
  setDomFromJsonContent,
} from "./composerTokens";
import type { ComposerNativeHandlers } from "./composerInputTypes";

export function useComposerEditor(options: {
  editorHostRef: RefObject<HTMLDivElement | null>;
  editorRef: RefObject<HTMLDivElement | null>;
  variant: "compact" | "panel";
  disabled?: boolean;
  lastEmittedContentRef: RefObject<JSONContent | null | undefined>;
  imageRegistryRef: RefObject<ComposerImageRegistry>;
  nativeHandlersRef: RefObject<ComposerNativeHandlers | null>;
  imagePreviewElRef: RefObject<HTMLDivElement | null>;
  imagePreviewHideTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
  activePreviewImageIdRef: RefObject<string | null>;
  activePreviewChipRef: RefObject<HTMLElement | null>;
  setPlaceholderVisible: (visible: boolean) => void;
  isEmptyRef: RefObject<boolean>;
  setIsEmpty: Dispatch<SetStateAction<boolean>>;
  onIsEmptyChange?: (isEmpty: boolean) => void;
  /** 输入区超过一行时通知外层切圆角；仅值变化时触发 */
  onMultilineChange?: (multiline: boolean) => void;
  /** 每次量高后都触发，供外层按单行槽宽重算展开态 */
  onLayoutMeasure?: () => void;
}) {
  const {
    editorHostRef,
    editorRef,
    variant,
    disabled,
    lastEmittedContentRef,
    imageRegistryRef,
    nativeHandlersRef,
    imagePreviewElRef,
    imagePreviewHideTimerRef,
    activePreviewImageIdRef,
    activePreviewChipRef,
    setPlaceholderVisible,
    isEmptyRef,
    setIsEmpty,
    onIsEmptyChange,
    onMultilineChange,
    onLayoutMeasure,
  } = options;

  // 挂载 effect 依赖为空，回调经 ref 取最新，避免重建编辑器节点
  const onMultilineChangeRef = useRef(onMultilineChange);
  const onLayoutMeasureRef = useRef(onLayoutMeasure);
  useEffect(() => {
    onMultilineChangeRef.current = onMultilineChange;
    onLayoutMeasureRef.current = onLayoutMeasure;
  }, [onMultilineChange, onLayoutMeasure]);

  useLayoutEffect(() => {
    const host = editorHostRef.current;
    if (!host || editorRef.current) return;

    const el = document.createElement("div");
    el.setAttribute("role", "textbox");
    el.setAttribute("aria-label", "AI 输入");
    el.setAttribute("aria-multiline", "true");
    el.dataset.aiComposerEditor = "true";
    el.dataset.aiComposerVariant = variant;
    el.spellcheck = false;
    // 类名只写一次；之后禁用态用 classList 改，不整段替换
    el.className = [
      "block w-full bg-transparent p-0 text-foreground outline-none",
      "overflow-y-auto break-words whitespace-pre-wrap",
      variant === "panel"
        ? "min-h-[24px] max-h-[96px] text-[13px] leading-6"
        : "min-h-[20px] max-h-[88px] text-[12px] leading-[20px]",
    ].join(" ");
    el.contentEditable = "true";
    // 编辑宿主默认可聚焦但不在 Tab 序（tabIndex=-1）；显式 0 才能从工具栏 Tab 进来。
    el.tabIndex = 0;

    const onBeforeInput = (event: Event) =>
      nativeHandlersRef.current?.onBeforeInput(event);
    const onInput = (event: Event) =>
      nativeHandlersRef.current?.onInput(event);
    const onKeyDown = (event: KeyboardEvent) =>
      nativeHandlersRef.current?.onKeyDown(event);
    const onClick = (event: MouseEvent) =>
      nativeHandlersRef.current?.onClick(event);
    const onMouseOver = (event: MouseEvent) =>
      nativeHandlersRef.current?.onMouseOver(event);
    const onMouseOut = (event: MouseEvent) =>
      nativeHandlersRef.current?.onMouseOut(event);
    const onBlur = () => nativeHandlersRef.current?.onBlur();
    const onPaste = (event: ClipboardEvent) =>
      nativeHandlersRef.current?.onPaste(event);
    const onCompositionStart = () =>
      nativeHandlersRef.current?.onCompositionStart();
    const onCompositionEnd = () =>
      nativeHandlersRef.current?.onCompositionEnd();

    // 预览浮层：进入时取消关闭，离开时延迟关闭（每实例独立 portal）
    const previewEl = createImagePreviewPortal();
    imagePreviewElRef.current = previewEl;
    const onPreviewEnter = () => {
      if (imagePreviewHideTimerRef.current != null) {
        clearTimeout(imagePreviewHideTimerRef.current);
        imagePreviewHideTimerRef.current = null;
      }
    };
    const onPreviewLeave = () => {
      if (imagePreviewHideTimerRef.current != null) {
        clearTimeout(imagePreviewHideTimerRef.current);
      }
      imagePreviewHideTimerRef.current = setTimeout(() => {
        imagePreviewHideTimerRef.current = null;
        const preview = imagePreviewElRef.current;
        if (!preview) return;
        preview.style.display = "none";
        preview.replaceChildren();
        preview.setAttribute("aria-hidden", "true");
        activePreviewImageIdRef.current = null;
        activePreviewChipRef.current = null;
      }, IMAGE_PREVIEW_HIDE_MS);
    };

    el.addEventListener("beforeinput", onBeforeInput);
    el.addEventListener("input", onInput);
    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("click", onClick);
    el.addEventListener("mouseover", onMouseOver);
    el.addEventListener("mouseout", onMouseOut);
    el.addEventListener("paste", onPaste);
    el.addEventListener("blur", onBlur);
    el.addEventListener("compositionstart", onCompositionStart);
    el.addEventListener("compositionend", onCompositionEnd);
    previewEl.addEventListener("mouseenter", onPreviewEnter);
    previewEl.addEventListener("mouseleave", onPreviewLeave);

    host.appendChild(el);
    editorRef.current = el;

    // panel 变体：量内容高度写 --ai-composer-h（24–96，4 行封顶），
    // 超一行打 data-multiline 标记并通知外层切圆角。
    // 先还原高度再读 scrollHeight，避免上次的高度值喂回测量。
    const measureHeight =
      variant === "panel"
        ? () => {
            el.style.height = "auto";
            const next = Math.min(Math.max(el.scrollHeight, 24), 96);
            el.style.height = "";
            el.style.setProperty("--ai-composer-h", `${next}px`);
            const multiline = next > 25;
            const changed = el.dataset.multiline !== String(multiline);
            el.dataset.multiline = String(multiline);
            if (changed) onMultilineChangeRef.current?.(multiline);
            onLayoutMeasureRef.current?.();
          }
        : null;
    // chip 增删、换行、粘贴都走 DOM 变化；MutationObserver 一并覆盖，
    // IME composing 期间照测，不打断输入。
    const observer = measureHeight
      ? new MutationObserver(() => {
          // 高度与 chrome 换排在同一次提交完成，ResizeObserver 只看到最终布局。
          flushSync(measureHeight);
        })
      : null;
    if (observer) {
      observer.observe(el, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    // 展开会改变编辑槽宽；只监听宽度，避免量高写回触发循环。
    let measuredWidth = el.clientWidth;
    const resizeObserver = measureHeight
      ? new ResizeObserver(() => {
          const width = el.clientWidth;
          if (width === measuredWidth) return;
          measuredWidth = width;
          measureHeight();
        })
      : null;
    resizeObserver?.observe(el);

    // 首次种子（若有）：同步空态给发送按钮，避免切回面板时草稿已在但按钮仍灰
    const seed = lastEmittedContentRef.current;
    if (seed) {
      setDomFromJsonContent(el, seed, imageRegistryRef.current);
    }
    const tokens = readTokensFromDom(el);
    const payload = buildPayloadFromTokens(tokens);
    const empty = isComposerPayloadEmpty(payload);
    setPlaceholderVisible(empty);
    isEmptyRef.current = empty;
    setIsEmpty(empty);
    onIsEmptyChange?.(empty);
    measureHeight?.();

    return () => {
      observer?.disconnect();
      resizeObserver?.disconnect();
      el.removeEventListener("beforeinput", onBeforeInput);
      el.removeEventListener("input", onInput);
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("click", onClick);
      el.removeEventListener("mouseover", onMouseOver);
      el.removeEventListener("mouseout", onMouseOut);
      el.removeEventListener("paste", onPaste);
      el.removeEventListener("blur", onBlur);
      el.removeEventListener("compositionstart", onCompositionStart);
      el.removeEventListener("compositionend", onCompositionEnd);
      previewEl.removeEventListener("mouseenter", onPreviewEnter);
      previewEl.removeEventListener("mouseleave", onPreviewLeave);
      if (imagePreviewHideTimerRef.current != null) {
        clearTimeout(imagePreviewHideTimerRef.current);
        imagePreviewHideTimerRef.current = null;
      }
      // 仅当本实例持有该 portal 时移除，避免多 composer 互相拆掉
      if (imagePreviewElRef.current === previewEl) {
        previewEl.remove();
        imagePreviewElRef.current = null;
      }
      activePreviewImageIdRef.current = null;
      activePreviewChipRef.current = null;
      el.remove();
      editorRef.current = null;
    };
    // variant 固定按实例；禁止依赖变化重建节点
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // disabled 只改属性，不重建节点、不碰 className 整串
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.contentEditable = disabled ? "false" : "true";
    el.tabIndex = disabled ? -1 : 0;
    el.setAttribute("aria-disabled", disabled ? "true" : "false");
    el.classList.toggle("cursor-not-allowed", Boolean(disabled));
    el.classList.toggle("opacity-60", Boolean(disabled));
  }, [disabled, editorRef]);
}
