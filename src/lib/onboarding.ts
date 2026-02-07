import type { JSONContent } from "@/types";

const WELCOME_IMAGE =
  "https://goose-notion-1257312034.cos.ap-guangzhou.myqcloud.com/welcome-cover.png";

export const ONBOARDING_PAGE_CONTENT: JSONContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "鹅的笔记 · 新手指南" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "欢迎使用鹅的笔记，这是一个快速记录与整理的空间。",
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "本页展示常用区块，直接点击即可编辑。",
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "在空白行输入 / 可唤起功能菜单。" },
      ],
    },
    {
      type: "paragraph",
    },
    {
      type: "imageResize",
      attrs: { src: WELCOME_IMAGE },
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "排版" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "这是一个普通段落，用于记录你的想法。" }],
    },
    {
      type: "heading",
      attrs: { level: 3 },
      content: [{ type: "text", text: "列表与待办" }],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "无序列表：收集想法" }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "无序列表：拆分步骤" }],
            },
          ],
        },
      ],
    },
    {
      type: "orderedList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "有序列表：第一步" }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "有序列表：第二步" }],
            },
          ],
        },
      ],
    },
    {
      type: "taskList",
      content: [
        {
          type: "taskItem",
          attrs: { checked: true },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "待办：捕捉想法" }],
            },
          ],
        },
        {
          type: "taskItem",
          attrs: { checked: false },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "待办：整理结构" }],
            },
          ],
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "引用与代码" }],
    },
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "灵感趁新鲜，先记下来。" }],
        },
      ],
    },
    {
      type: "codeBlock",
      content: [
        {
          type: "text",
          text: "print(\"Hello, Goose Notes\")\nlog(\"Today's idea\")",
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "公式与图表" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "行内公式示例：" },
        { type: "inlineMath", attrs: { value: "E=mc^2" } },
        { type: "text", text: "，适合写在句子里。" },
      ],
    },
    {
      type: "codeBlock",
      attrs: { language: "math" },
      content: [
        {
          type: "text",
          text: "f(x)=\\int_0^1 x^2 \\, dx",
        },
      ],
    },
    {
      type: "codeBlock",
      attrs: { language: "mermaid" },
      content: [
        {
          type: "text",
          text: "flowchart LR\nA[灵感] --> B{整理}\nB --> C[行动]",
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "提示与分隔" }],
    },
    {
      type: "callout",
      attrs: { emoji: "✨" },
      content: [{ type: "text", text: "提示框可以强调重点信息。" }],
    },
    {
      type: "horizontalRule",
    },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableHeader",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "功能" }],
                },
              ],
            },
            {
              type: "tableHeader",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "说明" }],
                },
              ],
            },
          ],
        },
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "页面层级" }],
                },
              ],
            },
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "无限深度" }],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "提示：在侧边栏展开本页，可看到子页面「功能速览」。",
        },
      ],
    },
  ],
};

export const ONBOARDING_CHILD_PAGE_CONTENT: JSONContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "功能速览" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "这是一个子页面，用于展示层级与快捷方式。",
        },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "支持无限层级的页面结构" }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "拖拽可排序与嵌套" }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "输入 / 打开功能菜单" }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "新增控件：提示框、公式块、Mermaid 图表、分隔线",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export const ONBOARDING_SECOND_CHILD_CONTENT: JSONContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "快捷键指南" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "掌握这些快捷键，让你的记录更加高效。",
        },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Cmd/Ctrl + N：新建页面" }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Cmd/Ctrl + S：保存内容" }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "/ ：唤起功能菜单" }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "拖拽段落左侧手柄调整顺序" }],
            },
          ],
        },
      ],
    },
  ],
};
