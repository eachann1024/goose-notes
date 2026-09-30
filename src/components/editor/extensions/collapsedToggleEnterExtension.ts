import { createExtension } from "@blocknote/core";

/**
 * 折叠列表 Enter 行为修正 + toggleListItem 内置快捷键的收起态感知重实现（兼容漏网旧数据）。
 *
 * toggleListItem 的内置扩展 `toggle-list-item-shortcuts` 对非空块无条件分裂，
 * 已在 Editor.tsx disable；行为在本扩展按收起态重实现。
 */

export type ToggleBlock = {
  id: string;
  type: string;
  props?: unknown;
  children?: unknown[];
};

export function isToggleBlock(block: ToggleBlock): boolean {
  return block.type === "toggleListItem";
}

/** 读 DOM 折叠态（BlockNote 把展开态同步到 .bn-toggle-wrapper[data-show-children]）。 */
function toggleShowChildren(block: ToggleBlock): string | null {
  const wrapper = document.querySelector(
    `[data-id="${block.id}"] .bn-toggle-wrapper`,
  );
  return wrapper?.getAttribute("data-show-children") ?? null;
}

/** 块是否处于「收起态折叠块」：是折叠块 + 有 children + DOM 标记收起。 */
function isCollapsedToggleWithChildren(block: ToggleBlock): boolean {
  if (!isToggleBlock(block)) return false;
  if (!block.children || block.children.length === 0) return false;
  return toggleShowChildren(block) === "false";
}

/** 块是否处于「展开态折叠块且有 children」。 */
function isExpandedToggleWithChildren(block: ToggleBlock): boolean {
  if (!isToggleBlock(block)) return false;
  if (!block.children || block.children.length === 0) return false;
  return toggleShowChildren(block) === "true";
}

/** 全树找 id 对应块的父块（顶层块返回 null）。 */
export function findParentBlock(
  blocks: ToggleBlock[],
  id: string,
  parent: ToggleBlock | null = null,
): ToggleBlock | null | undefined {
  for (const b of blocks) {
    if (b.id === id) return parent;
    if (b.children?.length) {
      const found = findParentBlock(b.children as ToggleBlock[], id, b);
      if (found !== undefined) return found;
    }
  }
  return undefined;
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

      // ── 折叠块 children 内的空块回车：禁止默认「空块提升」──
      // 默认 lift 会把空块提到折叠块外面，且后续兄弟块整体被挂到提出的空段落
      // 下面——折叠块被掏空、缩进结构全乱（用户实测）。后面还有兄弟内容时
      // 改为在其后新增一行；空块已是最后一个 child 时放行默认 lift（此时
      // 没有可破坏的兄弟，lift 出去正好是「逃出折叠块」的手感）。
      // 限定非折叠块自身：空 toggleListItem 有自己的「原地降级」分支（见下）。
      if (block.content.length === 0 && !isToggleBlock(block)) {
        const parent = findParentBlock(
          editor.document as ToggleBlock[],
          block.id,
        );
        if (parent && isToggleBlock(parent)) {
          const siblings = parent.children as ToggleBlock[];
          const idx = siblings.findIndex((s) => s.id === block.id);
          if (idx !== -1 && idx < siblings.length - 1) {
            editor.transact(() => {
              const [inserted] = editor.insertBlocks(
                [{ type: "paragraph" as const, content: [] } as any],
                block,
                "after",
              );
              if (inserted) editor.setTextCursorPosition(inserted, "start");
            });
            return true;
          }
        }
      }

      // ── 收起态折叠块（toggleListItem / isToggleable heading）核心修复 ──
      // 行首除外：行首分裂是在上方拆空行，children 留原块，安全（下方 keepType 分裂兜底）。
      if ($from.parentOffset !== 0 && isCollapsedToggleWithChildren(block)) {
        const { before, after } = splitInlineContent(
          block.content as InlineItem[],
          $from.parentOffset,
        );
        const newBlock = { type: "toggleListItem" as const, content: after };
        editor.transact(() => {
          if (after.length > 0) {
            editor.updateBlock(block, { content: before as any });
          }
          const [inserted] = editor.insertBlocks([newBlock as any], block, "after");
          if (inserted) editor.setTextCursorPosition(inserted, "start");
        });
        return true;
      }

      // ── 展开态折叠块（有 children）行中/行尾回车：光标后内容送进折叠块内部、
      // 成为第一个 child（行尾则是空段落），光标落进去——Notion 手感。
      // 不能走 keepType 分裂：分裂会把整棵 children 转移给分裂出的新块，
      // 原折叠块被掏空（用户实测「内容被清空、下面多了个空折叠行」）。
      if ($from.parentOffset !== 0 && isExpandedToggleWithChildren(block)) {
        const { before, after } = splitInlineContent(
          block.content as InlineItem[],
          $from.parentOffset,
        );
        const firstChild = (block.children as { id: string }[])[0];
        editor.transact(() => {
          if (after.length > 0) {
            editor.updateBlock(block, { content: before as any });
          }
          const [inserted] = editor.insertBlocks(
            [{ type: "paragraph" as const, content: after } as any],
            firstChild,
            "before",
          );
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
  },
});
