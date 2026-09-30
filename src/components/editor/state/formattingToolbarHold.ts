import { createContext, useContext } from "react";

/**
 * BlockNote 在 editor pointerdown 时会关掉格式栏，pointerup 才按选区恢复。
 * 已有选区再拖选另一行时，按住期间保持打开，避免挡住的上一行闪一下。
 */
export const FormattingToolbarHoldContext = createContext(false);

export function useFormattingToolbarHold() {
  return useContext(FormattingToolbarHoldContext);
}
