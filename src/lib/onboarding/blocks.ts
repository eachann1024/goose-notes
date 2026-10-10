import type { PartialBlock } from "@blocknote/core";

export const paragraph = (value?: string): PartialBlock => ({
  type: "paragraph",
  content: value || "",
});

export const heading = (level: number, value: string): PartialBlock => ({
  type: "heading",
  props: { level },
  content: value,
});

export const bulletList = (items: string[]): PartialBlock[] =>
  items.map((item) => ({ type: "bulletListItem", content: item }));

export const orderedList = (items: string[]): PartialBlock[] =>
  items.map((item) => ({ type: "numberedListItem", content: item }));

export const taskList = (
  items: Array<{ checked: boolean; text: string }>,
): PartialBlock[] =>
  items.map((item) => ({
    type: "checkListItem",
    props: { checked: item.checked },
    content: item.text,
  }));

export const quote = (value: string): PartialBlock => ({
  type: "quote",
  content: value,
});

// SAFETY: BlockNote 内置类型未导出项目自定义 callout 的 icon prop，运行时 propSchema 接受它。
export const callout = (icon: string, value: string): PartialBlock =>
  ({
    type: "callout",
    props: { icon },
    content: value,
  }) as unknown as PartialBlock;

export const codeBlock = (value: string, language?: string): PartialBlock => ({
  type: "codeBlock",
  props: { language: language || "" },
  content: value,
});

export const table = (headers: string[], rows: string[][]): PartialBlock => ({
  type: "table",
  content: {
    type: "tableContent",
    rows: [{ cells: headers }, ...rows.map((row) => ({ cells: row }))],
  },
});

export const divider = (): PartialBlock => ({
  type: "divider",
});

export const image = (src: string): PartialBlock => ({
  type: "image",
  props: { url: src, caption: "" },
});
