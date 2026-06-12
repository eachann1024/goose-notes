import { createExtension } from "@blocknote/core";

/**
 * 折叠块 Enter 行为修正 + toggleListItem 内置快捷键的收起态感知重实现。
 *
 * 问题：折叠块（toggleListItem / isToggleable heading）**收起**时，光标在标题行按 Enter，
 * 分裂会把整棵 children 子树转移给分裂出的新块——收起的内容被挤出原折叠块、
 * 挂到新块下面，再点折叠箭头也收不回来（用户实测）。
 *
 * toggleListItem 的内置扩展 `toggle-list-item-shortcuts` 的 Enter handler（dist 里的 Zn）
 * 对非空 toggleListItem 无条件接管 keepType 分裂（不感知收起态），且块 spec 扩展注册顺序
 * 先于 options.extensions，自定义扩展拦不到。故在 Editor.tsx 里把它整个 disable，
 * 其全部行为在本扩展按收起态感知重实现：
 *
 * - 空 toggleListItem 回车 → 原地降级 paragraph（复刻内置）。
 * - **收起 + 有 children** 的 toggleListItem 行中/行尾回车 → 光标后文本切给下方新建的
 *   **同级空折叠列表**，children 留在原块（Notion 手感，本扩展的核心修复）。
 * - **收起 + 有 children** 的 isToggleable heading 行中/行尾回车 → 下方新建**段落**，
 *   children 留在原块。
 * - 展开 / 无 children 的非空 toggleListItem 回车 → keepType 分裂（复刻内置 Xn：
 *   tr.split 深度 2，children 跟分裂后块）。不能 return false 走默认——默认 splitBlock
 *   分裂出的是 paragraph（实测），手感退化。
 * - 行首（parentOffset === 0）回车 → 同样走 keepType 分裂：上方拆出空 toggle 行，
 *   原内容与 children 完好留在下方（与原内置行为一致，收起态也安全）。
 * - Mod-Shift-6 → 当前 inline 块转 toggleListItem（复刻内置）。
 *
 * 收起态判断：BlockNote 0.51 的 ToggleWrapper 把展开态存在 localStorage（toggle-<id>）
 * 并同步到 DOM 的 .bn-toggle-wrapper[data-show-children]。读 DOM 与 UI 实际状态一致。
 */

/** 块是否处于「收起态折叠块」：是折叠块 + 有 children + DOM 标记收起。 */
function isCollapsedToggleWithChildren(block: {
  id: string;
  type: string;
  props?: unknown;
  children?: unknown[];
}): boolean {
  const isToggle =
    block.type === "toggleListItem" ||
    (block.type === "heading" &&
      (block.props as { isToggleable?: boolean })?.isToggleable === true);
  if (!isToggle) return false;
  if (!block.children || block.children.length === 0) return false;
  const wrapper = document.querySelector(
    `[data-id="${block.id}"] .bn-toggle-wrapper`,
  );
  return wrapper?.getAttribute("data-show-children") === "false";
}

type InlineItem = {
  type: string;
  text?: string;
  content?: InlineItem[];
  [key: string]: unknown;
};

/**
 * 把 inline content 数组按光标字符偏移切成前后两半。
 * text 节点按字符切；link 等带嵌套 content 的节点递归切内部；
 * 其余原子节点（hardBreak 等）按长度 1 整体归边。
 */
function splitInlineContent(
  items: InlineItem[],
  offset: number,
): { before: InlineItem[]; after: InlineItem[] } {
  const before: InlineItem[] = [];
  const after: InlineItem[] = [];
  let remaining = offset;
  const lengthOf = (it: InlineItem): number => {
    if (typeof it.text === "string") return it.text.length;
    if (Array.isArray(it.content)) return it.content.reduce((s, c) => s + lengthOf(c), 0);
    return 1;
  };
  for (const it of items) {
    const len = lengthOf(it);
    if (remaining >= len) {
      before.push(it);
      remaining -= len;
    } else if (remaining <= 0) {
      after.push(it);
    } else if (typeof it.text === "string") {
      before.push({ ...it, text: it.text.slice(0, remaining) });
      after.push({ ...it, text: it.text.slice(remaining) });
      remaining = 0;
    } else if (Array.isArray(it.content)) {
      const inner = splitInlineContent(it.content, remaining);
      if (inner.before.length) before.push({ ...it, content: inner.before });
      if (inner.after.length) after.push({ ...it, content: inner.after });
      remaining = 0;
    } else {
      // 原子节点切不开，整体归后半
      after.push(it);
      remaining = 0;
    }
  }
  return { before, after };
}

export const gooseCollapsedToggleEnterExtension = createExtension({
  key: "goose-collapsed-toggle-enter",
  keyboardShortcuts: {
    Enter: ({ editor }) => {
      const state = editor.prosemirrorState;
      if (!state.selection.empty) return false;
      const $from = state.selection.$from;
      const block = editor.getTextCursorPosition().block;
      if (!Array.isArray(block.content)) return false;

      // ── 收起态折叠块（toggleListItem / isToggleable heading）核心修复 ──
      // 行首除外：行首分裂是在上方拆空行，children 留原块，安全（下方 keepType 分裂兜底）。
      if ($from.parentOffset !== 0 && isCollapsedToggleWithChildren(block)) {
        const { before, after } = splitInlineContent(
          block.content as InlineItem[],
          $from.parentOffset,
        );
        const newBlock =
          block.type === "toggleListItem"
            ? { type: "toggleListItem" as const, content: after }
            : { type: "paragraph" as const, content: after };
        editor.transact(() => {
          if (after.length > 0) {
            editor.updateBlock(block, { content: before as any });
          }
          const [inserted] = editor.insertBlocks([newBlock as any], block, "after");
          if (inserted) editor.setTextCursorPosition(inserted, "start");
        });
        return true;
      }

      // ── 以下复刻被禁用的 toggle-list-item-shortcuts 的 Enter（仅 toggleListItem）──
      if (block.type !== "toggleListItem") return false;

      // 空块 → 原地降级 paragraph（复刻内置）。
      if (block.content.length === 0) {
        editor.updateBlock(block, { type: "paragraph", props: {} });
        return true;
      }

      // 非空（展开 / 无 children / 行首）→ keepType 分裂（复刻内置 Xn）：
      // blockContainer 深度 2 分裂，分裂后块保持 toggleListItem 类型、props 重置，
      // children（blockGroup 物理在切口后）自然跟分裂后块。
      editor.transact((tr) => {
        const $pos = tr.selection.$from;
        tr.split($pos.pos, 2, [
          { type: $pos.node(-1).type, attrs: {} },
          { type: $pos.parent.type, attrs: {} },
        ]);
      });
      return true;
    },
    // 复刻被禁用扩展的 Mod-Shift-6：当前 inline 块转折叠列表。
    "Mod-Shift-6": ({ editor }) => {
      const { block } = editor.getTextCursorPosition();
      const spec = (editor.schema.blockSchema as Record<string, { content?: string }>)[
        block.type
      ];
      if (spec?.content !== "inline") return false;
      editor.updateBlock(block, { type: "toggleListItem", props: {} });
      return true;
    },
  },
});
