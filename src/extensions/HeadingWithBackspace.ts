import Heading from "@tiptap/extension-heading";

export const HeadingWithBackspace = Heading.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Backspace: () => {
        const { selection } = this.editor.state;
        const { empty, $anchor } = selection;
        const isAtStart = $anchor.pos === $anchor.start();

        if (!empty || !isAtStart) {
          return false;
        }

        const node = $anchor.parent;
        if (node.type.name === "heading" && node.content.size === 0) {
          this.editor.commands.setNode("paragraph");
          return true;
        }

        return false;
      },
    };
  },
});
