import { useFormattingToolbarState } from "./useFormattingToolbarState";
import { FormattingToolbarLayout } from "./FormattingToolbarLayout";

export { shouldRenderFormattingToolbar } from "./selectionPolicy";

export function EditorFormattingToolbar() {
  const state = useFormattingToolbarState();
  return state.visible ? <FormattingToolbarLayout state={state} /> : null;
}
