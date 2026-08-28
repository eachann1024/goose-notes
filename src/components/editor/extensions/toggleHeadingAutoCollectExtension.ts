import { createExtension } from "@blocknote/core";

/**
 * 折叠标题自动收编已停用：所有 heading（除物理首块）默认可折，
 * 新建/转换时不再把后续兄弟块收进 children。
 * 仅保留空扩展挂载，避免改动 Editor 装配点。
 */

export const gooseToggleHeadingAutoCollectExtension = createExtension(
  () => ({
    key: "goose-toggle-heading-auto-collect",
    mount({ signal }: { signal: AbortSignal }) {
      signal.addEventListener("abort", () => {});
    },
  }),
);
