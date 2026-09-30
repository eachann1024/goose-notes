import { createExtension } from "@blocknote/core";

type EditorBlock = {
  id: string;
  type: string;
};

type DividerCursorEditor = {
  schema: {
    blockSpecs?: Record<string, { config?: { content?: string } }>;
  };
  getBlock: (id: string) => EditorBlock | undefined;
  getNextBlock: (block: EditorBlock) => EditorBlock | undefined;
  insertBlocks: (
    blocks: Array<{ type: string; content: never[] }>,
    reference: EditorBlock,
    placement: "after",
  ) => EditorBlock[];
  setTextCursorPosition: (block: EditorBlock, placement: "start") => void;
};

/**
 * 行首至少三个连字符，后接空白（空格或 Enter 喂入的 `\n`）。
 * 导出供单测，并作为 input rule 的 `find`。
 */
export const DIVIDER_INPUT_RULE_FIND = /^---+\s$/;

/**
 * 行首 `---`（至少三个连字符）可触发分割线（空白由本次输入补上）。
 */
export function matchDividerTrigger(
  textBefore: string,
): { triggerText: string } | null {
  const matched = /^---+$/u.exec(textBefore);
  if (!matched) return null;
  return { triggerText: matched[0] };
}

/**
 * `---` + 空格/回车变成分割线后，把光标送到下一行。
 *
 * 若分割线下方已有可编辑块，直接聚焦它；若下方为空或仍是无光标块，
 * 就紧跟分割线插入一个空段落。这样不会为了移动光标改写已有正文。
 */
export function moveCursorAfterDivider(
  editor: DividerCursorEditor,
  dividerId: string,
): void {
  const divider = editor.getBlock(dividerId);
  if (!divider || divider.type !== "divider") return;

  const nextBlock = editor.getNextBlock(divider);
  const nextContentType = nextBlock
    ? editor.schema.blockSpecs?.[nextBlock.type]?.config?.content
    : undefined;

  if (nextBlock && nextContentType !== "none") {
    editor.setTextCursorPosition(nextBlock, "start");
    return;
  }

  const [paragraph] = editor.insertBlocks(
    [{ type: "paragraph", content: [] }],
    divider,
    "after",
  );
  if (paragraph) editor.setTextCursorPosition(paragraph, "start");
}

/**
 * 替代 BlockNote 原生 divider input rule。
 * 原生 `/^---$/` 在敲完第三个 `-` 时立即转换，和 `# ` / `- ` 等「标记 + 空格」
 * 不一致；这里改成 `/^---+\s$/`，让 `---` + 空格（以及 Enter 喂入的 `\n`）才转分割线。
 * 原规则还会把选择留在 void block 上；等事务落地后，再通过公开 API 建立下一行并移动光标。
 */
export const gooseDividerInputRuleExtension = createExtension(({ editor }) => ({
  key: "goose-divider-input-rule",
  inputRules: [
    {
      find: DIVIDER_INPUT_RULE_FIND,
      replace() {
        let blockId: string;
        try {
          blockId = editor.getTextCursorPosition().block.id;
        } catch {
          return undefined;
        }

        queueMicrotask(() =>
          moveCursorAfterDivider(
            editor as unknown as DividerCursorEditor,
            blockId,
          ),
        );
        return { type: "divider", props: {}, content: [] } as any;
      },
    },
  ],
}));
