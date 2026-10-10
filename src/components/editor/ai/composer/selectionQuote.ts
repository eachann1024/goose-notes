/** 选区引用入口与待挂载输入框的追加队列。 */
import {
  APPEND_COMPOSER_SELECTION_EVENT,
  OPEN_AI_PANEL_EVENT,
  FOCUS_AI_COMPOSER_EVENT,
  readAiPanelActive,
  type AppendComposerSelectionDetail,
} from "./selectionQuoteData";
export * from "./selectionQuoteData";
export * from "./selectionQuoteDom";

const pendingAppendComposerSelections: AppendComposerSelectionDetail[] = [];

export function takePendingAppendComposerSelections(): AppendComposerSelectionDetail[] {
  return pendingAppendComposerSelections.splice(
    0,
    pendingAppendComposerSelections.length,
  );
}

/** 消费成功（true）才出队；失败留在队列里等输入框挂载后再试。 */
export function consumePendingAppendComposerSelections(
  consume: (detail: AppendComposerSelectionDetail) => boolean,
): number {
  let i = 0;
  while (i < pendingAppendComposerSelections.length) {
    const detail = pendingAppendComposerSelections[i];
    if (!detail || consume(detail)) {
      pendingAppendComposerSelections.splice(i, 1);
      continue;
    }
    i += 1;
  }
  return pendingAppendComposerSelections.length;
}

export function dispatchAppendComposerSelection(
  detail: AppendComposerSelectionDetail,
): void {
  pendingAppendComposerSelections.push(detail);
  window.dispatchEvent(
    readAiPanelActive()
      ? new CustomEvent(OPEN_AI_PANEL_EVENT)
      : new CustomEvent(OPEN_AI_PANEL_EVENT, {
          detail: { layout: "side-panel" },
        }),
  );
  window.dispatchEvent(
    new CustomEvent(APPEND_COMPOSER_SELECTION_EVENT, { detail }),
  );
  window.dispatchEvent(new CustomEvent(FOCUS_AI_COMPOSER_EVENT));
}
