import * as LucideIcons from "lucide-react";

export const getSuggestionItems = ({ query }: { query: string }) => {
  return [
    {
      type: "divider",
    },
    {
      title: "文本",
      description: "开始输入纯文本",
      searchTerms: ["text", "wenben", "p"],
      icon: LucideIcons.Type,
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
      title: "一级标题",
      description: "主要作为大标题使用",
      searchTerms: ["h1", "heading1", "title", "biaoti"],
      icon: LucideIcons.Heading1,
      shortcut: "#",
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setDetails().run();
      },
    },
    {
      title: "提示框",
      description: "插入带图标的重点提示 (Callout)",
      searchTerms: ["callout", "info", "tishi"],
      icon: LucideIcons.Info,
      shortcut: "co",
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setCallout().run();
      },
    },
  ].filter((item) => {
    if (item.type === "divider") return true;
    if (
      typeof query === "string" &&
      query.length > 0 &&
      item.title &&
      item.description
    ) {
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
