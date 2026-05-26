import { useEffect } from "react";
import { toast } from "sonner";
import { useSettings, EDITOR_FONT_SIZE_DEFAULT } from "@/stores/useSettings";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useTabs } from "@/stores/useTabs";

export function useAppHotkeys() {
  const {
    uiFontSize,
    increaseEditorFontSize,
    decreaseEditorFontSize,
    setEditorFontSize,
  } = useSettings();

  useEffect(() => {
    const handleZoomKeys = (event: KeyboardEvent) => {
      const isZoomInKey =
        event.key === "+" ||
        event.key === "=" ||
        event.code === "Equal" ||
        event.code === "NumpadAdd";
      const isZoomOutKey =
        event.key === "-" ||
        event.code === "Minus" ||
        event.code === "NumpadSubtract";
      const isZoomResetKey =
        event.key === "0" ||
        event.code === "Digit0" ||
        event.code === "Numpad0";

      if (event.key === "F3") {
        event.preventDefault();
        event.stopPropagation();
        window.dispatchEvent(
          new CustomEvent("goose-note:editor-find-nav", {
            detail: { direction: event.shiftKey ? -1 : 1 },
          }),
        );
        return;
      }

      if (!event.metaKey && !event.ctrlKey) return;
      if (event.altKey || event.repeat) return;

      const target = document.activeElement;
      const isEditableInput =
        target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      const isRichTextEditing =
        target instanceof HTMLElement &&
        (target.isContentEditable || !!target.closest(".bn-editor"));

      const isOpenSettingsHotkey =
        (event.key === "," || event.key === "，" || event.code === "Comma") &&
        !event.shiftKey;
      const isOpenSearchHotkey =
        event.key.toLowerCase() === "k" && event.shiftKey;

      if (isOpenSearchHotkey && (isEditableInput || isRichTextEditing)) {
        return;
      }

      if (isOpenSettingsHotkey) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("goose-note:open-settings"));
        return;
      }

      if (isOpenSearchHotkey) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("goose-note:open-search"));
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent("goose-note:editor-find-open"));
        return;
      }

      if (event.key.toLowerCase() === "g") {
        event.preventDefault();
        event.stopPropagation();
        window.dispatchEvent(
          new CustomEvent("goose-note:editor-find-nav", {
            detail: { direction: event.shiftKey ? -1 : 1 },
          }),
        );
        return;
      }

      if (isZoomInKey) {
        event.preventDefault();
        increaseEditorFontSize();
        return;
      }

      if (isZoomOutKey) {
        event.preventDefault();
        decreaseEditorFontSize();
        return;
      }

      if (isZoomResetKey) {
        event.preventDefault();
        setEditorFontSize(EDITOR_FONT_SIZE_DEFAULT);
        return;
      }

      if (isEditableInput) return;

      if (event.key.toLowerCase() === "s" && !event.shiftKey) {
        event.preventDefault();
        void (async () => {
          window.dispatchEvent(
            new CustomEvent("goose-note:flush-editor", {
              detail: { immediate: true },
            }),
          );
          await usePages.getState().flushPendingLocalSaves();
          toast("内容已保存", { duration: 1500 });
        })();
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        const { createPage } = usePages.getState();
        const { activeNotebookId } = useNotebooks.getState();
        if (activeNotebookId) {
          const newPageId = createPage(undefined, activeNotebookId);
          useTabs.getState().openTab(newPageId);
          toast("已创建新笔记", { duration: 1500 });
        }
      }
    };

    document.addEventListener("keydown", handleZoomKeys, true);
    return () => {
      document.removeEventListener("keydown", handleZoomKeys, true);
    };
  }, [
    uiFontSize,
    increaseEditorFontSize,
    decreaseEditorFontSize,
    setEditorFontSize,
  ]);
}
