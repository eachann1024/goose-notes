import { createExtension } from "@blocknote/core";
import { isInsideToggle } from "@/components/editor/utils/toggleNesting";

/**
 * Notion 风格折叠触发：在「块行首」输入 `> `(半角 > + 空格)或 `》 `(全角)时，按当前块类型分发：
 * - heading  → 转「可折叠标题」(heading.props.isToggleable = true)，保留原级别与文字；
 *             转换后把该标题之后的**同层兄弟块**依次收编为它的 children，直到遇到
 *             type === "heading" 且 props.level <= 当前 level 的块为止（同级/更高级标题
 *             不收编，更低级标题收编）。收编在 setTimeout(0) 异步执行（inputRule replace
 *             返回后文档尚未落定，同步读 document 会取到旧状态）。
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
 * - 收编采用 setTimeout(0)：inputRule replace 返回时 BlockNote document 尚未更新到新状态；
 *   0ms 宏任务后文档已落定，可安全读取兄弟块并做 removeBlocks + updateBlock。
 *   ToggleWrapper 的 childAdded 机制会在 children 增加时自动展开，无需额外控制展开态。
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
          const props = block.props as { isToggleable?: boolean; level?: number };
          if (props?.isToggleable) return undefined; // 已是折叠标题，放行

          // 记录当前块信息用于异步收编，replace 返回后文档尚未更新所以这里存 snapshot。
          const blockId = block.id;
          const headingLevel = (props?.level ?? 1) as number;

          // 异步收编：等 inputRule 的 transaction 落定后再读文档。
          window.setTimeout(() => {
            absorbSiblings(editor, blockId, headingLevel);
          }, 0);

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

/**
 * 把 headingBlockId 之后的同层兄弟块收编为其 children，
 * 直到遇到 type === "heading" 且 props.level <= headingLevel 为止。
 */
function absorbSiblings(editor: any, headingBlockId: string, headingLevel: number): void {
  // 在更新后的 document 中找到目标块。
  const headingBlock = findBlockById(editor.document, headingBlockId);
  if (!headingBlock) return;

  // 找到该块在其父容器中的同层兄弟列表。
  const siblings = getSiblingList(editor.document, headingBlockId);
  if (!siblings) return;

  const headingIndex = siblings.findIndex((b: any) => b.id === headingBlockId);
  if (headingIndex === -1) return;

  // 收集从 headingIndex+1 开始、直到遇到同级/更高级标题前的所有块。
  const absorbed: any[] = [];
  for (let i = headingIndex + 1; i < siblings.length; i++) {
    const sib = siblings[i];
    if (
      sib.type === "heading" &&
      ((sib.props as any)?.level ?? 1) <= headingLevel
    ) {
      break;
    }
    absorbed.push(sib);
  }

  if (absorbed.length === 0) return;

  // 深拷贝 absorbed（removeBlocks 后原引用可能变陈旧）。
  const absorbedSnapshot = JSON.parse(JSON.stringify(absorbed));

  // 先移除后附加：BlockNote 0.51 无 transact API 对外暴露，顺序执行。
  // 时序说明：先 removeBlocks 再 updateBlock 追加 children；
  // 期间 children 先减后增，ToggleWrapper childAdded 会在增加时触发自动展开。
  editor.removeBlocks(absorbed);

  const existingChildren = headingBlock.children ?? [];
  editor.updateBlock(headingBlock, {
    children: [...existingChildren, ...absorbedSnapshot],
  });

  // 收编后光标回到 heading 标题末尾。
  try {
    const updatedHeading = findBlockById(editor.document, headingBlockId);
    if (updatedHeading) {
      editor.setTextCursorPosition(updatedHeading, "end");
    }
  } catch {
    // 忽略光标设置失败（极端情况）。
  }
}

/** 在整棵文档树中按 id 查找块（BFS）。 */
function findBlockById(blocks: any[], id: string): any | undefined {
  for (const block of blocks) {
    if (block.id === id) return block;
    if (block.children?.length) {
      const found = findBlockById(block.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * 找到包含 targetId 块的**直接父容器的子块列表**（即兄弟列表）。
 * 顶层块的父容器是 editor.document 本身。
 */
function getSiblingList(blocks: any[], targetId: string): any[] | undefined {
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].id === targetId) return blocks;
    if (blocks[i].children?.length) {
      const found = getSiblingList(blocks[i].children, targetId);
      if (found) return found;
    }
  }
  return undefined;
}
