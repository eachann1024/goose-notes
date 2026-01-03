import * as LucideIcons from "lucide-react";

export const getSuggestionItems = ({ query }: { query: string }) => {
  return [
    {
      title: "文本",
      description: "开始输入纯文本",
      searchTerms: ["text", "wenben", "p"],
      icon: LucideIcons.Type,
      shortcut: '""',
      hint: {
        title: "文本提示",
        items: [
          { key: "Mod + Alt + ↑/↓", description: "上下移动当前行" },
          { key: "Enter", description: "普通换行" },
          { key: "Shift + Enter", description: "软换行 (不分段)" },
        ],
      },
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleNode("paragraph", "paragraph")
          .run();
      },
    },
    {
      title: "一级标题",
      description: "主要作为大标题使用",
      searchTerms: ["h1", "heading1", "title", "biaoti"],
      icon: LucideIcons.Heading1,
      shortcut: "#",
      hint: {
        title: "标题提示",
        items: [
          { key: "⌫", description: "行首按：转回普通正文" },
          { key: "Mod + Alt + 1", description: "快捷切换到此级别" },
        ],
      },
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
      description: "主要作为中等标题使用",
      searchTerms: ["h2", "heading2", "subtitle", "biaoti"],
      icon: LucideIcons.Heading2,
      shortcut: "##",
      hint: {
        title: "标题提示",
        items: [
          { key: "⌫", description: "行首按：转回普通正文" },
          { key: "Mod + Alt + 2", description: "快捷切换到此级别" },
        ],
      },
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
      description: "主要作为小标题使用",
      searchTerms: ["h3", "heading3", "subtitle", "biaoti"],
      icon: LucideIcons.Heading3,
      shortcut: "###",
      hint: {
        title: "标题提示",
        items: [
          { key: "⌫", description: "行首按：转回普通正文" },
          { key: "Mod + Alt + 3", description: "快捷切换到此级别" },
        ],
      },
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
      title: "项目列表",
      description: "创建一个简单的项目列表",
      searchTerms: ["ul", "unordered", "xiangmu"],
      icon: LucideIcons.List,
      shortcut: "-",
      hint: {
        title: "列表提示",
        items: [
          { key: "Tab", description: "向内缩进一层" },
          { key: "Shift + Tab", description: "向外取消缩进" },
          { key: "Enter", description: "创建下一个列表项" },
        ],
      },
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: "有序列表",
      description: "创建一个有序列表",
      searchTerms: ["ol", "ordered", "youxu"],
      icon: LucideIcons.ListOrdered,
      shortcut: "1.",
      hint: {
        title: "列表提示",
        items: [
          { key: "Tab / Shift + Tab", description: "调整层级" },
          { key: "Enter", description: "自动生成序号" },
        ],
      },
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "待办列表",
      description: "使用待办事项跟踪任务",
      searchTerms: ["todo", "task", "list", "check", "daiban"],
      icon: LucideIcons.CheckSquare,
      shortcut: "[]",
      hint: {
        title: "待办提示",
        items: [
          { key: "Mod + Enter", description: "切换完成状态" },
          { key: "Tab / Shift + Tab", description: "调整缩进层级" },
          { key: "Enter", description: "创建下一个待办" },
        ],
      },
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: "引用",
      description: "引用一段文本",
      searchTerms: ["quote", "blockquote", "yinyong"],
      icon: LucideIcons.TextQuote,
      shortcut: ">",
      hint: {
        title: "引用提示",
        items: [
          { key: "Enter", description: "行首按：上方插入正文行" },
          { key: "Shift + Enter", description: "在引用内换行" },
          { key: "⌫", description: "行首按：取消引用样式" },
        ],
      },
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      title: "代码块",
      description: "插入代码片段",
      searchTerms: ["codeblock", "daima"],
      icon: LucideIcons.Code,
      shortcut: "```",
      hint: {
        title: "代码提示",
        items: [
          { key: "Tab", description: "插入缩进 (4 空格)" },
          { key: "连按三下 Enter", description: "快速跳出代码块" },
          { key: "Mod + A", description: "全选块内代码" },
        ],
      },
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      title: "图片",
      description: "上传或嵌入图片的链接",
      searchTerms: ["image", "picture", "file", "tupian"],
      icon: LucideIcons.Image,
      shortcut: "img",
      hint: {
        title: "图片提示",
        items: [
          { key: "拖拽入内", description: "直接将图片文件拖入编辑器上传" },
          { key: "Resize", description: "选中图片后拖拽边缘调节宽度" },
          { key: "Mod + V", description: "直接粘贴剪贴板中的图片" },
        ],
      },
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setImagePlaceholder().run();
      },
    },
    {
      title: "表格",
      description: "插入一个简单的表格",
      searchTerms: ["table", "grid", "biaoge"],
      icon: LucideIcons.Table2,
      shortcut: "tb",
      hint: {
        title: "表格提示",
        items: [
          { key: "Tab", description: "跳至下个单元格 / 末尾加行" },
          { key: "Mod + Enter", description: "在表格下方快速插入新段落" },
          { key: "右键点击", description: "调出行/列操作详细菜单" },
        ],
      },
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
      title: "行内代码",
      description: "插入简短的代码片段",
      searchTerms: ["code", "inline", "hangnei"],
      icon: LucideIcons.Code2,
      shortcut: "e",
      hint: {
        title: "代码提示",
        items: [
          { key: "Mod + E", description: "快速切换行内代码" },
          { key: "`", description: "输入反引号自动包裹" },
        ],
      },
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setMark("code").run();
      },
    },
  ].filter((item) => {
    if (typeof query === "string" && query.length > 0) {
      const search = query.toLowerCase();
      return (
        item.title.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search) ||
        (item.searchTerms &&
          item.searchTerms.some((term: string) => term.includes(search)))
      );
    }
    return true;
  });
};
