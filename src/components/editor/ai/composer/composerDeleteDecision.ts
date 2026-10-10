import { isComposerDeleteInputType } from "./composerInputGuards";

export type ComposerBeforeInputDeleteAction =
  | "ignore"
  | "clear-editor"
  | "delete-selection-chips"
  | "remove-chip-before"
  | "remove-chip-after";

/**
 * beforeinput 删除决策（纯函数）。
 * IME 会话中必须 ignore，绝不自定义删。
 */
export function resolveComposerBeforeInputDelete(options: {
  inputType: string | undefined;
  imeActive: boolean;
  hasChips: boolean;
  selectionCoversEntire: boolean;
  rangeCollapsed: boolean;
  rangeContainsChip: boolean;
  chipBeforeCaret: boolean;
  chipAfterCaret: boolean;
}): ComposerBeforeInputDeleteAction {
  if (options.imeActive) return "ignore";
  if (!isComposerDeleteInputType(options.inputType)) return "ignore";
  if (!options.hasChips) return "ignore";

  if (options.selectionCoversEntire) return "clear-editor";

  if (!options.rangeCollapsed && options.rangeContainsChip) {
    return "delete-selection-chips";
  }

  if (options.rangeCollapsed) {
    const type = options.inputType ?? "";
    const backward =
      type === "deleteContentBackward" ||
      type === "deleteWordBackward" ||
      type === "deleteSoftLineBackward" ||
      type === "deleteHardLineBackward";
    const forward =
      type === "deleteContentForward" ||
      type === "deleteWordForward" ||
      type === "deleteSoftLineForward" ||
      type === "deleteHardLineForward";

    if (backward && options.chipBeforeCaret) return "remove-chip-before";
    if (forward && options.chipAfterCaret) return "remove-chip-after";
  }

  return "ignore";
}
