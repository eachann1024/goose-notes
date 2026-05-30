import { createExtension } from "@blocknote/core";

/**
 * Notion 风格折叠标题触发：在「已有文字的标题块」末尾输入 `>`（或全角 `》`）时，
 * 把当前标题转成「可折叠标题」(heading.props.isToggleable = true)，保留原文字与级别。
 *
 * 触发条件（尽量避免误伤，结论见 plans/.../codex评审.md）：
 * - 当前块必须是 heading 且尚未 isToggleable；
 * - 标题已有可见文字（避免空标题误触）；
 * - `>` / `》` 前必须紧跟一个非空白、非 `>`、非 `-`/`=` 的字符——
 *   这样 `a > b` 不以 > 结尾不触发；`->`、`=>`（被 ArrowInputRule 接管成箭头）也不会被本规则抢；
 *   仅当标题文字结尾是「正常字符 + >」时才转换，符合「打完标题顺手补个 >」的直觉。
 *
 * 实现依据（BlockNote 0.51.3 dist 源码已核实）：
 * - inputRules 包成 @handlewithcare/prosemirror-inputrules 的 InputRule(find, handler)；
 * - handler 先调 replace()，仅当返回 truthy 才 deleteRange 删字符并转换；返回 undefined → return null，
 *   不产生 transaction，原字符保留，对其它块/已折叠标题安全放行；
 * - updateBlock 仅 merge 传入 props，未传 level 不被覆盖。
 */
export const gooseToggleHeadingInputRuleExtension = createExtension({
  key: "goose-toggle-heading-input-rule",
  inputRules: [
    {
      // lookbehind 断言前面是正常字符（不纳入匹配，故只删 > 不动标题文字）+ 可选空格 + > / 》 结尾；排除 - = > 紧邻，避开箭头规则与连续 >
      find: /(?<=[^\s>》\-=])\s?[>》]$/u,
      replace: ({ editor }) => {
        const block = editor.getTextCursorPosition().block;
        if (block.type !== "heading") return undefined;
        const props = block.props as { isToggleable?: boolean };
        if (props?.isToggleable) return undefined;
        return {
          type: "heading",
          props: { isToggleable: true },
        };
      },
    },
  ],
});
