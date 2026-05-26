import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "prosemirror-state";

const PLUGIN_KEY = new PluginKey("goose-code-block-link-strip");

// 兜底：autolink 插件不会区分 codeBlock node，导致代码块里写带协议的 URL
// （如 https://example.com）也会被自动加 link mark。这里在每次 transaction
// 后扫描所有代码块，把内部 link mark 清掉。
export const gooseCodeBlockLinkStripExtension = createExtension({
  key: "goose-code-block-link-strip",
  prosemirrorPlugins: [
    new Plugin({
      key: PLUGIN_KEY,
      appendTransaction(transactions, _oldState, newState) {
        if (!transactions.some((t) => t.docChanged)) return null;
        const linkType = newState.schema.marks.link;
        if (!linkType) return null;

        const ranges: Array<{ from: number; to: number }> = [];
        newState.doc.descendants((node, pos) => {
          if (node.type.name !== "codeBlock") return true;
          node.descendants((child, offset) => {
            if (!child.isText) return true;
            if (!linkType.isInSet(child.marks)) return true;
            const from = pos + 1 + offset;
            ranges.push({ from, to: from + child.nodeSize });
            return false;
          });
          return false;
        });

        if (ranges.length === 0) return null;
        const tr = newState.tr;
        for (const r of ranges) tr.removeMark(r.from, r.to, linkType);
        return tr;
      },
    }),
  ],
});
