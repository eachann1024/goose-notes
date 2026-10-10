import type { BlockNoteEditor } from "@blocknote/core";

export function createSlashBlockInsertion(
  editor: BlockNoteEditor<any, any, any>,
) {
  // 插入完成后：把光标移到新块、把视图滚动到新块、把焦点交回编辑器
  const focusAndScrollTo = (block: { id: string }) => {
    try {
      editor.setTextCursorPosition(block, "end");
    } catch {
      /* block 可能已被 BlockNote 内部刷新；忽略 */
    }
    editor.focus();
    // React 自定义块（如 codeBlock）的 contentDOM 挂载是异步的：上面同步设的
    // PM 光标位置在 DOM 里找不到落点，会被回退到块容器外——表现为创建代码块后
    // 立刻粘贴贴到块外。等本轮事件处理结束、React 挂载完成后补设一次，把 DOM
    // 光标真正送进块内。用 setTimeout 而非 rAF：后台标签页 rAF 不触发。
    window.setTimeout(() => {
      try {
        editor.setTextCursorPosition(block, "end");
      } catch {
        /* block 可能已被 BlockNote 内部刷新；忽略 */
      }
      editor.focus();
    }, 0);
    // 等 DOM 更新一帧后再滚动，确保新块已渲染
    requestAnimationFrame(() => {
      const el = document.querySelector(
        `[data-id="${block.id}"]`,
      ) as HTMLElement | null;
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };

  return (block: any): any => {
    // 必须在点击执行时实时读取当前块：BlockNote 在调用 onItemClick 之前已先跑过
    // closeMenu() → clearQuery()（删掉触发字符 / 或 、）。若沿用菜单构建时捕获的旧
    // 快照，content 仍带着 /，会误判 hasTrigger 并对陈旧 block 引用做二次清空，
    // 导致转换落到相邻块、整篇下移一行（用户反馈：第一行按 / 第二行却变成了标题）。
    const currentBlock = editor.getTextCursorPosition().block;
    const content = currentBlock.content as any;

    // 剥掉行首触发字符（/ 或 、），返回剩余 inline 内容。
    // 不能用「先 updateBlock 清空 content 再取光标块」的两步法：清空一个带 children 的块
    // （如带 children 的列表项）的标题后，光标会跳进它的第一个子块，第二步
    // getTextCursorPosition() 取到的是子块而非原块，导致转换落到子块、原块标题与缩进
    // 子内容（含图片）全部错乱丢失。改为对 currentBlock（稳定引用）一次性 updateBlock。
    const stripLeadingTrigger = (
      c: any,
    ): { hasTrigger: boolean; content: any } => {
      if (!Array.isArray(c) || c.length === 0 || c[0]?.type !== "text") {
        return { hasTrigger: false, content: c };
      }
      const text = c[0].text || "";
      const trigger = text.startsWith("/")
        ? "/"
        : text.startsWith("、")
          ? "、"
          : null;
      if (!trigger) return { hasTrigger: false, content: c };
      const nextText = text.slice(trigger.length);
      return {
        hasTrigger: true,
        content: nextText
          ? [{ ...c[0], text: nextText }, ...c.slice(1)]
          : c.slice(1),
      };
    };

    const stripped = stripLeadingTrigger(content);
    const hasTrigger = stripped.hasTrigger;

    let target: any;
    if (hasTrigger) {
      // 目标块若是 inline 内容块（段落/标题/各类列表项），保留剥掉触发符后的 content；
      // 若是结构化块（image/divider 等，content: "none"），不能塞 content。
      const targetKind = (editor.schema as any).blockSchema?.[block.type]
        ?.content;
      target = editor.updateBlock(
        currentBlock,
        targetKind === "inline"
          ? { ...block, content: stripped.content }
          : block,
      );
    } else {
      const isEmpty =
        !content ||
        (Array.isArray(content) && content.length === 0) ||
        (typeof content === "string" && content.trim() === "");
      if (isEmpty) {
        editor.updateBlock(currentBlock, block);
        target = currentBlock;
      } else {
        const [inserted] = editor.insertBlocks([block], currentBlock, "after");
        target = inserted;
      }
    }
    if (target?.id) focusAndScrollTo(target);
    return target;
  };
}
