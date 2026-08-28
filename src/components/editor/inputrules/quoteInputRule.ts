import { createExtension } from "@blocknote/core";

/**
 * 引用触发：在块行首输入「竖线 + 空格」时转 quote，支持半角 `| `(U+007C)与全角 `｜ `(U+FF5C)。
 *
 * 为什么不用内置的 `> `：`>` 不再用于折叠；引用用竖线触发。
 */
export const gooseQuoteInputRuleExtension = createExtension({
  key: "goose-quote-input-rules",
  inputRules: [
    {
      find: /^[|｜]\s$/u,
      replace: () => ({
        type: "quote",
        props: {},
      }),
    },
  ],
});
