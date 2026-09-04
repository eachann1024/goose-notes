import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core/blocks";
import { gooseHeadingBlockSpec } from "@/components/editor/blocks/heading/headingBlockSpec";
import { calloutBlock } from "@/components/editor/blocks/callout/calloutBlock";
import { customFileBlock } from "../blocks/file/customFileBlock";
import { customImageBlock } from "../blocks/image/customImageBlock";
import { customVideoBlock } from "../blocks/video/videoBlock";
import { codeBlockSpec } from "@/components/editor/blocks/code/codeBlockSpec";
import { gooseEditorStyleSpecs } from "@/components/editor/inline-code/InlineCodeComponent";
import { pageMentionSpec } from "@/components/editor/inline/pageMentionSpec";

export const editorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    // 普通 heading + props.collapsed；不用 BlockNote isToggleable children。
    heading: gooseHeadingBlockSpec,
    callout: calloutBlock,
    image: customImageBlock,
    video: customVideoBlock,
    file: customFileBlock,
    codeBlock: codeBlockSpec,
  },
  styleSpecs: gooseEditorStyleSpecs,
}).extend({
  inlineContentSpecs: {
    pageMention: pageMentionSpec,
  },
});
