import type { BlockNoteEditor } from "@blocknote/core";
import { FilePanelExtension } from "@blocknote/core/extensions";
import * as LucideIcons from "lucide-react";
import { useSettings } from "@/stores/useSettings";

export interface SlashMenuItem {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  aliases?: string[];
  badge?: string;
  disabled?: boolean;
  disabledReason?: string;
  children?: SlashMenuItem[];
  onItemClick: () => void;
}

export function getBlockNoteSlashMenuItems(editor: BlockNoteEditor<any, any, any>): SlashMenuItem[] {
  const currentBlock = editor.getTextCursorPosition().block;

  // 插入完成后：把光标移到新块、把视图滚动到新块、把焦点交回编辑器
  const focusAndScrollTo = (block: { id: string }) => {
    try {
      editor.setTextCursorPosition(block, "end");
    } catch { /* block 可能已被 BlockNote 内部刷新；忽略 */ }
    editor.focus();
    // 等 DOM 更新一帧后再滚动，确保新块已渲染
    requestAnimationFrame(() => {
      const el = document.querySelector(
        `[data-id="${block.id}"]`,
      ) as HTMLElement | null;
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };

  const insertOrUpdate = (block: any): any => {
    const content = currentBlock.content as any;
    const hasTrigger =
      Array.isArray(content) &&
      content.length >= 1 &&
      content[0]?.type === "text" &&
      ((content[0].text || "").startsWith("/") || (content[0].text || "").startsWith("、"));

    let target: any;
    if (hasTrigger) {
      editor.updateBlock(currentBlock, { content: [] });
      const clearedBlock = editor.getTextCursorPosition().block;
      editor.updateBlock(clearedBlock, block);
      target = clearedBlock;
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

  const items: SlashMenuItem[] = [];

  if (useSettings.getState().ai.enabled) {
    items.push({
      title: "生成",
      description: "接着写点什么...",
      icon: <LucideIcons.Sparkles size={18} />,
      aliases: ["ai", "generate", "shengcheng", "xiezuo", "sparkle"],
      badge: "Space",
      onItemClick: () => {
        // 删除触发字符 / 或 、
        const pos = editor.getTextCursorPosition();
        const block = pos.block;
        const content = block.content as any[];
        if (
          Array.isArray(content) &&
          content.length === 1 &&
          content[0]?.type === "text" &&
          (content[0].text === "/" || content[0].text === "、")
        ) {
          editor.updateBlock(block, { content: [] });
        } else if (
          Array.isArray(content) &&
          content.length >= 1 &&
          content[0]?.type === "text" &&
          (content[0].text.startsWith("/") || content[0].text.startsWith("、"))
        ) {
          const newText = content[0].text.slice(1);
          editor.updateBlock(block, {
            content: newText ? [{ ...content[0], text: newText }] : [],
          });
        }

        document.dispatchEvent(
          new CustomEvent("open-ai-input-popover", {
            detail: { editor },
          }),
        );
      },
    });
  }

  items.push(
    {
      title: "一级标题",
      description: "大标题",
      icon: <LucideIcons.Heading1 size={18} />,
      aliases: ["h1", "heading1", "title", "biaoti"],
      badge: "#",
      onItemClick: () =>
        insertOrUpdate({
          type: "heading",
          props: { level: 1 },
        }),
    },
    {
      title: "二级标题",
      description: "中标题",
      icon: <LucideIcons.Heading2 size={18} />,
      aliases: ["h2", "heading2", "subtitle", "biaoti"],
      badge: "##",
      onItemClick: () =>
        insertOrUpdate({
          type: "heading",
          props: { level: 2 },
        }),
    },
    {
      title: "三级标题",
      description: "小标题",
      icon: <LucideIcons.Heading3 size={18} />,
      aliases: ["h3", "heading3", "biaoti"],
      badge: "###",
      onItemClick: () =>
        insertOrUpdate({
          type: "heading",
          props: { level: 3 },
        }),
    },
    { type: "divider" } as any,
    {
      title: "待办事项",
      description: "带有复选框的任务列表",
      icon: <LucideIcons.CheckSquare size={18} />,
      aliases: ["todo", "task", "daiban", "renwu", "提醒", "提醒事项", "tixing"],
      badge: "[]",
      onItemClick: () => insertOrUpdate({ type: "checkListItem" }),
    },
    {
      title: "无序列表",
      description: "创建普通的项目符号列表",
      icon: <LucideIcons.List size={18} />,
      aliases: ["list", "bullet", "liebiao"],
      badge: "-",
      onItemClick: () => insertOrUpdate({ type: "bulletListItem" }),
    },
    {
      title: "有序列表",
      description: "创建带有数字的列表",
      icon: <LucideIcons.ListOrdered size={18} />,
      aliases: ["ordered", "list", "liebiao"],
      badge: "1.",
      onItemClick: () => insertOrUpdate({ type: "numberedListItem" }),
    },
    {
      title: "折叠列表",
      description: "可展开/收起内容的折叠列表",
      icon: <LucideIcons.ChevronRight size={18} />,
      aliases: ["toggle", "collapse", "fold", "zhedie", "shouqi"],
      badge: ">",
      onItemClick: () => insertOrUpdate({ type: "toggleListItem" }),
    },
    {
      title: "引用",
      description: "插入一段引用文字",
      icon: <LucideIcons.Quote size={18} />,
      aliases: ["quote", "blockquote", "yinyong"],
      badge: ">",
      onItemClick: () => insertOrUpdate({ type: "quote" }),
    },
    {
      title: "标注",
      description: "插入带图标的重点标注块",
      icon: <LucideIcons.Info size={18} />,
      aliases: ["callout", "annotation", "info", "biaozhu", "tishi"],
      badge: "co",
      onItemClick: () => insertOrUpdate({ type: "callout" }),
    },
    {
      title: "分隔线",
      description: "插入一条水平分割线",
      icon: <LucideIcons.Minus size={18} />,
      aliases: ["divider", "separator", "hr", "fengexian"],
      badge: "---",
      onItemClick: () => insertOrUpdate({ type: "divider" }),
    },
    { type: "divider" } as any,
    {
      title: "表格",
      description: "插入一个简单的表格",
      icon: <LucideIcons.Table size={18} />,
      aliases: ["table", "biaoge"],
      badge: "tb",
      onItemClick: () => {
        insertOrUpdate({
          type: "table",
          content: {
            type: "tableContent",
            rows: [{ cells: ["", "", ""] }, { cells: ["", "", ""] }],
          },
        } as any);
      },
    },
    {
      title: "代码块",
      description: "插入带语法高亮的代码块",
      icon: <LucideIcons.Code size={18} />,
      aliases: ["code", "block", "daima"],
      badge: "```",
      onItemClick: () =>
        insertOrUpdate({ type: "codeBlock", props: { language: "markdown" } }),
    },
    {
      title: "数学公式",
      description: "插入数学公式块 (KaTeX)",
      icon: <LucideIcons.Sigma size={18} />,
      aliases: ["math", "formula", "gongshi", "katex"],
      badge: "$$",
      onItemClick: () =>
        insertOrUpdate({ type: "codeBlock", props: { language: "math" } }),
    },
    {
      title: "Mermaid 图表",
      description: "插入流程图、时序图等 (Mermaid)",
      icon: <LucideIcons.GitGraph size={18} />,
      aliases: ["mermaid", "chart", "diagram", "tubiao"],
      badge: "mr",
      onItemClick: () =>
        insertOrUpdate({ type: "codeBlock", props: { language: "mermaid" } }),
    },
    {
      title: "图片",
      description: "插入图片选择器模块",
      icon: <LucideIcons.Image size={18} />,
      aliases: ["image", "photo", "tupian", "img"],
      badge: "img",
      onItemClick: () => {
        const inserted = insertOrUpdate({ type: "image" });
        editor.getExtension(FilePanelExtension)?.showMenu(inserted.id);
      },
    },
    {
      title: "文件",
      description: "上传附件并直接调用系统默认应用打开",
      icon: <LucideIcons.FileUp size={18} />,
      aliases: ["file", "attachment", "pdf", "wenjian", "fujian"],
      badge: "file",
      onItemClick: () => {
        const inserted = insertOrUpdate({ type: "file" });
        editor.getExtension(FilePanelExtension)?.showMenu(inserted.id);
      },
    },
  );

  return items;
}

export function filterSlashMenuItems(
  items: SlashMenuItem[],
  query: string,
): SlashMenuItem[] {
  const q = query.trim().toLowerCase();

  // No query: return all items (dividers included for grouping)
  if (!q.length) return items;

  // With query: only return matching non-divider items
  const matched = items.filter((item) => {
    if ((item as any).type === "divider") return false;
    const haystacks = [
      item.title,
      item.description ?? "",
      ...(item.aliases ?? []),
    ].map((v) => v.toLowerCase());
    return haystacks.some((v) => v.includes(q));
  });

  return matched;
}
