/**
 * 输入规则：`->` 自动替换为 `→`（类似 Notion）
 * 通过 tiptap Extension 挂载 ProseMirror InputRule
 */
// @ts-ignore
import { Extension } from "@tiptap/core";
// @ts-ignore
import { InputRule, inputRules } from "@handlewithcare/prosemirror-inputrules";

/**
 * Tiptap plugin key for the arrow input rule.
 */
function arrowInputRulePlugin() {
  return inputRules({
    rules: [
      new InputRule(
        /->$/,
        (state: any, _match: any, start: number, end: number) => {
          return state.tr.insertText("\u2192", start, end);
        },
        { inCode: false },
      ),
    ],
  });
}

export const ArrowInputRuleExtension = Extension.create({
  name: "arrowInputRule",

  addProseMirrorPlugins() {
    return [arrowInputRulePlugin()];
  },
});
