import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const URL_REGEX = /^https?:\/\/[^\s]+$/;

export const LinkPasteHandler = Extension.create({
  name: "linkPasteHandler",

  addProseMirrorPlugins() {
    const linkType = this.editor.schema.marks.link;
    if (!linkType) return [];

    return [
      new Plugin({
        key: new PluginKey("linkPasteHandler"),
        props: {
          handlePaste: (view, event) => {
            const { state } = view;
            const { selection } = state;
            const { empty, from, to } = selection;

            const text = event.clipboardData?.getData("text/plain")?.trim();
            if (!text || !URL_REGEX.test(text)) return false;

            event.preventDefault();

            const tr = state.tr;

            if (empty) {
              const linkNode = state.schema.text(text, [
                linkType.create({ href: text }),
              ]);
              tr.replaceSelectionWith(linkNode, false);
            } else {
              tr.addMark(from, to, linkType.create({ href: text }));
            }

            view.dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});
