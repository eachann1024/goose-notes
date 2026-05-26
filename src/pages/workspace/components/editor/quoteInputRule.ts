import { createExtension } from "@blocknote/core";

/**
 * 在 paragraph 行首输入「全角竖线 ｜（U+FF5C）+ 空格」时，
 * 把当前块转为 quote。与 BlockNote 内置的 `> ` 触发等价，方便中文输入法下直接输入。
 */
export const gooseQuoteInputRuleExtension = createExtension({
  key: "goose-quote-input-rules",
  inputRules: [
    {
      find: /^｜\s$/,
      replace: () => ({
        type: "quote",
        props: {},
      }),
    },
  ],
});
