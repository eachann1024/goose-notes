// dev 依赖预构建（esbuild）。显式 include 整条 BlockNote + AI SDK 链，
// 让它们与主体在同一次预构建里共享同一份 react，杜绝"第二份 React 实例"导致的
// useMemo/useState dispatcher 为 null 白屏。@ai-sdk/react 共享 React，
// 不在 src 直接 import，必须显式列出，否则可能被冷发现成非预构建模块而引入第二份 React。
export const optimizeDeps = {
  include: [
    "react",
    "react-dom",
    "react-dom/client",
    "react/jsx-runtime",
    "@blocknote/core",
    "@blocknote/react",
    "@blocknote/mantine",
    "@ai-sdk/react",
    "@ai-sdk/openai",
    "@ai-sdk/anthropic",
    "@ai-sdk/openai-compatible",
    "ai",
  ],
};
