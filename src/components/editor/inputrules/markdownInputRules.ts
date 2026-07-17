import { createExtension } from "@blocknote/core";

// 项目自定义了 codeBlock spec（见 codeBlockSpec.tsx），覆盖默认 spec 的同时丢掉了
// BlockNote 默认 ``` + 空格 → 代码块 的输入规则。这里照官方正则补回来，
// 语言名为空则 fallback 到 codeBlockSpec 的 propSchema 默认值 "text"。
export const gooseMarkdownInputRulesExtension = createExtension({
  key: "goose-markdown-input-rules",
  inputRules: [
    {
      // 中文输入法下输入 `1。 ` 时，也按内置 `1. ` 的行为转为有序列表。
      find: /^\s?(\d+)。\s$/u,
      replace: ({ match, editor }) => {
        if (editor.getTextCursorPosition().block.type === "heading") return;

        const start = Number.parseInt(match[1], 10);
        return {
          type: "numberedListItem",
          props: {
            start: start !== 1 ? start : undefined,
          },
        };
      },
    },
    {
      find: /^```(.*?)\s$/,
      replace: ({ match }) => ({
        type: "codeBlock",
        props: {
          language: match[1].trim() || "text",
        },
      }),
    },
  ],
});
