import { useEffect, type RefObject } from "react";
import type { AiComposerInputHandle } from "@/components/editor/ai/composer/AiComposerInput";
import { toast } from "@/components/ui/sonner";
import { REFINE_PLAN_EVENT, type RefinePlanRequest } from "./refinePlan";

/** 追加到现有草稿，保留引用和附件；由用户补充要求后发送。 */
export function usePlanRefinementInput(
  notebookId: string,
  inputRef: RefObject<AiComposerInputHandle | null>,
  disabled?: boolean,
) {
  useEffect(() => {
    const handleRefine = (event: Event) => {
      const request = (event as CustomEvent<RefinePlanRequest>).detail;
      if (request?.notebookId !== notebookId || !request.text) return;
      const input = inputRef.current;
      const el = input?.getEditorEl();
      if (disabled || !input || !el) {
        toast.error("输入框暂不可用，请稍后调整方案。");
        return;
      }
      input.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      const text = `${el.textContent?.trim() ? "\n\n" : ""}${request.text}`;
      // 原生插入会触发编辑器的草稿保存与撤销链路。
      if (!document.execCommand("insertText", false, text)) {
        const lines = text.split("\n");
        lines.forEach((line, index) => {
          if (index) el.appendChild(document.createElement("br"));
          el.appendChild(document.createTextNode(line));
        });
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      input.focus();
    };
    window.addEventListener(REFINE_PLAN_EVENT, handleRefine);
    return () => window.removeEventListener(REFINE_PLAN_EVENT, handleRefine);
  }, [disabled, inputRef, notebookId]);
}
