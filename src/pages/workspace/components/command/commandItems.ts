import * as LucideIcons from "lucide-react";
import { useSettings } from "@/stores/useSettings";

export interface CommandSuggestionItem {
  type?: "divider" | "item";
  title?: string;
  description?: string;
  searchTerms?: string[];
  icon?: any;
  shortcut?: string;
  disabled?: boolean;
  disabledReason?: string;
  command?: (params: { editor: any; range: any }) => void;
}

export const getSuggestionItems = ({ query }: { query: string }) => {
  const normalizedQuery =
    typeof query === "string" ? query.trim().toLowerCase() : "";
  const defaultCodeBlockWrap = useSettings.getState().defaultCodeBlockWrap;

  const items: CommandSuggestionItem[] = [
    {
      title: "一级标题",
      description: "大标题",
      searchTerms: ["h1", "heading1", "title", "biaoti"],
      icon: LucideIcons.Heading1,
      shortcut: "#",
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 1 })
          .run();
      },
    },
    {
      title: "二级标题",
      description: "中标题",
      searchTerms: ["h2", "heading2", "subtitle", "biaoti"],
      icon: LucideIcons.Heading2,
      shortcut: "##",
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 2 })
          .run();
      },
    },
    {
      title: "三级标题",
      description: "小标题",
      searchTerms: ["h3", "heading3", "biaoti"],
      icon: LucideIcons.Heading3,
      shortcut: "###",
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 3 })
          .run();
      },
    },
    {
      type: "divider",
    },
    {
      title: "待办事项",
      description: "带有复选框的任务列表",
      searchTerms: ["todo", "task", "daiban", "renwu"],
      icon: LucideIcons.CheckSquare,
      shortcut: "[]",
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: "无序列表",
      description: "创建普通的项目符号列表",
      searchTerms: ["list", "bullet", "liebiao"],
      icon: LucideIcons.List,
      shortcut: "-",
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: "有序列表",
      description: "创建带有数字的列表",
      searchTerms: ["ordered", "list", "liebiao"],
      icon: LucideIcons.ListOrdered,
      shortcut: "1.",
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "引用",
      description: "插入一段引用文字",
      searchTerms: ["quote", "blockquote", "yinyong"],
      icon: LucideIcons.Quote,
      shortcut: ">",
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      title: "标注",
      description: "插入带图标的重点标注块",
      searchTerms: ["callout", "annotation", "info", "biaozhu", "tishi"],
      icon: LucideIcons.Info,
      shortcut: "co",
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setCallout().run();
      },
    },
    {
      title: "分隔线",
      description: "插入一条水平分割线",
      searchTerms: ["divider", "separator", "hr", "fengexian"],
      icon: LucideIcons.Minus,
      shortcut: "---",
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      type: "divider",
    },
    {
      title: "表格",
      description: "插入一个简单的表格",
      searchTerms: ["table", "biaoge"],
      icon: LucideIcons.Table,
      shortcut: "tb",
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },
    },
    {
      title: "代码块",
      description: "插入带语法高亮的代码块",
      searchTerms: ["code", "block", "daima"],
      icon: LucideIcons.Code,
      shortcut: "```",
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleCodeBlock({ language: "markdown", wrap: defaultCodeBlockWrap })
          .run();
      },
    },
    {
      title: "数学公式",
      description: "插入数学公式块 (KaTeX)",
      searchTerms: ["math", "formula", "gongshi", "katex"],
      icon: LucideIcons.Sigma,
      shortcut: "$$",
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleCodeBlock({ language: "math", wrap: defaultCodeBlockWrap })
          .run();
      },
    },
    {
      title: "Mermaid 图表",
      description: "插入流程图、时序图等 (Mermaid)",
      searchTerms: ["mermaid", "chart", "diagram", "tubiao"],
      icon: LucideIcons.GitGraph,
      shortcut: "mr",
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleCodeBlock({ language: "mermaid", wrap: defaultCodeBlockWrap })
          .run();
      },
    },
    {
      title: "图片",
      description: "插入图片选择器模块",
      searchTerms: ["image", "photo", "tupian", "img"],
      icon: LucideIcons.Image,
      shortcut: "img",
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setImagePlaceholder().run();
      },
    },
    {
      title: "文件",
      description: "上传附件并直接调用系统默认应用打开",
      searchTerms: ["file", "attachment", "pdf", "wenjian", "fujian"],
      icon: LucideIcons.FileUp,
      shortcut: "file",
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setFileUploadPlaceholder().run();
      },
    },

  ];

  return items.filter((item: CommandSuggestionItem) => {
    if (item.type === "divider") return true;
    if (
      normalizedQuery.length > 0 &&
      item.title &&
      item.description
    ) {
      return (
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery) ||
        (item.searchTerms &&
          item.searchTerms.some((term: string) =>
            term.toLowerCase().includes(normalizedQuery),
          ))
      );
    }
    return true;
  }).reduce((acc: CommandSuggestionItem[], item: CommandSuggestionItem) => {
    // Pass 1: Collapse adjacent dividers
    if (item.type === "divider") {
      const lastItem = acc[acc.length - 1];
      if (!lastItem || lastItem.type === "divider") {
        return acc;
      }
    }
    acc.push(item);
    return acc;
  }, []).filter((item: CommandSuggestionItem, index: number, array: CommandSuggestionItem[]) => {
    // Pass 2: Remove trailing divider (Leading was handled by reducing !lastItem check implicitly if we consider empty acc, but let's be explicit)
    if (item.type === "divider") {
         if (index === array.length - 1) return false;
    }
    return true;
  });
};
