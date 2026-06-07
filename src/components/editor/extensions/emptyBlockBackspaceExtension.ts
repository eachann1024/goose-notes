import { createExtension } from "@blocknote/core";

/**
 * 「删除空控件 → 原地降级为普通空段落，光标留在当前行」。全局统一手感。
 *
 * 问题：光标在一个**空的非段落控件**（空标题 / 空折叠标题 / 空引用 / 空 callout / 空代码块…）
 * 开头按 Backspace 时，ProseMirror 默认 keymap 的 joinBackward 会把它**向前合并进上一块**，
 * 光标随之跳到上一块末尾（见用户截图：删空标题，光标跑到上面「123」标题后面）。
 * 这既不符合预期（光标应留在当前行），合并进折叠块时还会破坏上一块 children。
 *
 * 修复：当「光标空选区 + 在块内容开头 + 当前块内容为空 + 当前块无 children + 当前块是
 * 可降级的非段落控件」时，改为 updateBlock(block, { type: "paragraph" })——把这个空控件
 * **原地还原成普通空段落**，块本身不移除、光标自然留在本行，绝不向前合并、不跳行。
 *
 * 严格的放行边界（任一不满足即 return false 交还默认）：
 * - 非空选区 → 默认（跨块选区删除由 crossBlockDeleteExtension 处理）。
 * - 光标不在块开头（parentOffset !== 0）→ 默认（块内普通删除保持原样）。
 * - 当前块内容非空 → 默认（非空块的块内删除保持默认手感）。
 * - 当前块已是 paragraph → 默认（已是纯文本段落，无可降级；再删走 PM 默认回上一行）。
 * - 当前块是列表项（bullet/numbered/check/toggleListItem）→ 默认，交给 BlockNote 原生
 *   降级逻辑（它们原生 Backspace 本就会变 paragraph / 调整缩进），避免与原生冲突。
 * - 当前块带 children（如带子项的折叠块）→ 默认，paragraph 不支持 children，绝不在此破坏子树。
 * - 当前块无 inline 内容模型（image/file/divider 等 void 块，content 非数组）→ 默认。
 *
 * 实现依据（BlockNote 0.51 dist 源码已核实）：BlockNote 自身无块合并 API，向前合并完全来自
 * PM 默认 joinBackward；updateBlock 仅切换块 type、保留为空内容，光标停留当前块。
 */

/** 交给 BlockNote 原生降级逻辑的列表项类型，本扩展不接管。 */
const LIST_ITEM_TYPES = new Set([
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
]);

/** 块是否「有 inline 内容模型且当前为空」。void 块（image/file/divider）content 非数组 → false。 */
function isInlineBlockEmpty(block: { content?: unknown }): boolean {
  return Array.isArray(block.content) && block.content.length === 0;
}

export const gooseEmptyBlockBackspaceExtension = createExtension({
  key: "goose-empty-block-backspace",
  keyboardShortcuts: {
    Backspace: ({ editor }) => {
      const state = editor.prosemirrorState;
      // 仅处理光标（空选区）；非空选区交给 crossBlockDelete / 默认。
      if (!state.selection.empty) return false;
      // 必须落在块内容最开头，否则是块内普通删除，放行默认。
      if (state.selection.$from.parentOffset !== 0) return false;

      const block = editor.getTextCursorPosition().block;

      // 已是普通段落 → 放行默认（再删走 PM 默认：回上一行）。
      if (block.type === "paragraph") return false;
      // 列表项 → 交给 BlockNote 原生降级，避免冲突。
      if (LIST_ITEM_TYPES.has(block.type)) return false;
      // 内容非空 → 默认（非空块块内删除保持默认手感）。
      if (!isInlineBlockEmpty(block)) return false;
      // 带 children（折叠块等）→ 默认，paragraph 不支持 children，不在此破坏子树。
      if (block.children && block.children.length > 0) return false;

      // 空的非段落控件：原地降级为普通空段落，光标留当前行，不向前合并、不跳行。
      editor.updateBlock(block, { type: "paragraph", props: {} });
      editor.setTextCursorPosition(block, "start");
      return true;
    },
  },
});
