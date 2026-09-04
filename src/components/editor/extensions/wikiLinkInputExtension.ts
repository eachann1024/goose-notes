import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import {
  PAGE_MENTION_TYPE,
  pageMentionFromWikiLink,
} from "@/components/editor/inline/pageMention";

const pluginKey = new PluginKey("goose-wiki-link-input");

export const gooseWikiLinkInputExtension = createExtension({
  key: "goose-wiki-link-input",
  prosemirrorPlugins: [
    new Plugin({
      key: pluginKey,
      appendTransaction(transactions, _oldState, newState) {
        if (!transactions.some((tr) => tr.docChanged)) return null;
        const { selection } = newState;
        if (!selection.empty) return null;
        const $from = selection.$from;
        if (!$from.parent.isTextblock || $from.parent.type.spec.code) {
          return null;
        }
        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type.name === "codeBlock") return null;
        }
        if ($from.marks().some((mark) => mark.type.name === "code")) {
          return null;
        }
        const textBefore = $from.parent.textBetween(
          0,
          $from.parentOffset,
          undefined,
          "\ufffc",
        );
        const match = /\[\[([^\]\n]+?)\]\]$/.exec(textBefore);
        if (!match) return null;
        const mention = pageMentionFromWikiLink(match[1] ?? "");
        if (!mention) return null;
        const mentionType = newState.schema.nodes[PAGE_MENTION_TYPE];
        if (!mentionType) return null;
        const from = $from.start() + (match.index ?? 0);
        const to = $from.pos;
        const node = mentionType.create({
          pageId: mention.pageId,
          workspaceId: mention.workspaceId,
          title: mention.title,
          notebookName: mention.notebookName,
          wikiTarget: mention.wikiTarget,
        });
        return newState.tr.replaceWith(from, to, node);
      },
    }),
  ],
});
