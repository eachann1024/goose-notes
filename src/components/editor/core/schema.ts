import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core/blocks";
import { createHeadingBlockSpec } from "@blocknote/core";
import { calloutBlock } from "@/pages/workspace/components/editor/calloutBlock";
import { customFileBlock } from "../blocks/file/customFileBlock";
import { codeBlockSpec } from "@/pages/workspace/components/editor/codeBlockSpec";

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
