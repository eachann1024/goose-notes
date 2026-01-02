export const getSuggestionItems = ({ query }: { query: string }) => {
  return [
    {
      title: "文本",
      description: "开始输入纯文本",
      searchTerms: ["text", "wenben", "p"],
      icon: LucideIcons.Text,
      shortcut: '""',
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
      title: "待办列表",
      description: "使用待办事项跟踪任务",
      searchTerms: ["todo", "task", "list", "check", "daiban"],
      icon: LucideIcons.CheckSquare,
      shortcut: "[]",
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: "一级标题",
      description: "主要作为大标题使用",
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
      description: "主要作为中等标题使用",
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
      description: "主要作为小标题使用",
      searchTerms: ["h3", "heading3", "subtitle", "biaoti"],
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
      title: "项目列表",
      description: "创建一个简单的项目列表",
      searchTerms: ["ul", "unordered", "xiangmu"],
      icon: LucideIcons.List,
      shortcut: "-",
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
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "引用",
      description: "引用一段文本",
      searchTerms: ["quote", "blockquote", "yinyong"],
      icon: LucideIcons.TextQuote,
      shortcut: ">",
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
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
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
