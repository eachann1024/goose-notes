import { blockToNode, type PartialBlock } from "@blocknote/core";
import { Fragment } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

/** 整篇导航只需一次替换，不走逐块删除和位置映射。 */
export function replacePageContent(tr: Transaction, blocks: PartialBlock<any, any, any>[]): Transaction {
  const schema = tr.doc.type.schema;
  const group = schema.nodes.blockGroup.createChecked(
    null,
    blocks.map((block) => blockToNode(block, schema)),
  );
  group.check();
  return tr.replaceWith(0, tr.doc.content.size, Fragment.from(group))
    .setMeta("addToHistory", false);
}
