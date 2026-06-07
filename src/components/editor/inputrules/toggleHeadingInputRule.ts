import { createExtension } from "@blocknote/core";
import { isInsideToggle } from "@/components/editor/utils/toggleNesting";

/**
 * Notion 风格折叠触发：在「块行首」输入 `> `(半角 > + 空格)或 `》 `(全角)时，按当前块类型分发：
 * - heading  → 转「可折叠标题」(heading.props.isToggleable = true)，保留原级别与文字；
 * - paragraph→ 转「折叠列表」(toggleListItem)；
 * - 其他块类型(列表项/特殊块/已折叠标题…) → 不动，原样保留 `> ` 字符。
 *
 * 设计为「单条 inputRule 内按类型分发」而非两条规则：两条规则共用同一触发符 `> ` 会产生
 * 注册顺序竞争；合成一条后由 replace 内部判定，行为确定。
 *
 * 前置依赖（缺一不可）：
 * - schema.ts 必须 `allowToggleHeadings: true`，否则 heading 没有 isToggleable 字段，
 *   折叠标题分支静默失效。
 * - 内置 `> ` → quote 规则须由 disableExtensions(['quote-block-shortcuts']) 禁用，
 *   否则它会抢先把 paragraph 转成引用（见 Editor.tsx 配置）。引用改用 `| `/`｜ `。
 *
 * 实现依据（BlockNote 0.51 dist 源码已核实）：
 * - inputRules 的 handler 先调 replace()，仅当返回 truthy 才 deleteRange 删掉匹配的 `> `
 *   并转换；返回 undefined → 不产生 transaction，原字符保留，对其它块安全放行。
 * - updateBlock 仅 merge 传入 props，heading 未传 level 不被覆盖。
 */
export const gooseToggleHeadingInputRuleExtension = createExtension({
  key: "goose-toggle-heading-input-rule",
  inputRules: [
    {
      // 行首 > / 》 + 空格。整段被匹配，replace 返回 truthy 时这两个字符会被删除。
      find: /^[>》]\s$/u,
      replace: ({ editor }) => {
        const block = editor.getTextCursorPosition().block;

        // 首块恒为「文件名标题」(H1，见 firstTitleGuard)，不允许被改成折叠形态。
        if (block.id === editor.document[0]?.id) return undefined;

        // 折叠块内部不允许再生成折叠块(任意后代)，避免无限折叠嵌套。
        // 此时 `> ` 原样保留(return undefined)，不转折叠标题/折叠列表。
        if (isInsideToggle(editor, block)) return undefined;

        if (block.type === "heading") {
          const props = block.props as { isToggleable?: boolean };
          if (props?.isToggleable) return undefined; // 已是折叠标题，放行
          return {
            type: "heading",
            props: { isToggleable: true },
          };
        }

        // 仅普通段落转折叠列表；其它块(列表项/引用/代码块/标注等)一律不转。
        if (block.type === "paragraph") {
          return {
            type: "toggleListItem",
            props: {},
          };
        }

        return undefined;
      },
    },
  ],
});
