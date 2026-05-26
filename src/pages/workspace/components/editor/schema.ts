import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core/blocks";
import { createHeadingBlockSpec } from "@blocknote/core";
import { calloutBlock } from "./calloutBlock";
import { customFileBlock } from "./customFileBlock";
import { codeBlockSpec } from "./codeBlockSpec";

export const editorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    heading: createHeadingBlockSpec({
      levels: [1, 2, 3],
      allowToggleHeadings: false,
    }),
    callout: calloutBlock,
    file: customFileBlock,
    codeBlock: codeBlockSpec,
  },
});
