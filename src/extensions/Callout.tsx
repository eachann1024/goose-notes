import { Node, mergeAttributes, ReactNodeViewRenderer } from "@tiptap/react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import { InputRule } from "@tiptap/core";
import { IconSelector } from "@/pages/workspace/components/shared/IconSelector";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: () => ReturnType;
    };
  }
}

const CalloutView = ({ node, updateAttributes }: any) => {
  const emoji = node.attrs.emoji || "💡";

  return (
    <NodeViewWrapper className="callout-node flex gap-3 p-4 my-4 rounded-lg border bg-muted/20 border-border/50 items-center group">
      <div contentEditable={false} className="select-none flex-shrink-0">
        <IconSelector
          value={emoji}
          onChange={(icon) => updateAttributes({ emoji: icon })}
          emojiOnly
        >
          <div className="cursor-pointer hover:scale-110 transition-transform text-2xl flex items-center justify-center rounded hover:bg-muted">
            {emoji}
          </div>
        </IconSelector>
      </div>
      <div className="flex-1 min-w-0">
        <NodeViewContent className="callout-content outline-none" />
      </div>
    </NodeViewWrapper>
  );
};

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "inline*",
  selectable: true,
  draggable: true,

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          const emoji = node.attrs.emoji || "💡";
          state.write(`> ${emoji} `);
          state.renderInline(node);
          state.closeBlock(node);
        },
        parse: {
          setup(markdownit: any) {
            // 解析逻辑比较复杂，通常不需要反向解析 markdown 到 callout，因为我们主要关注复制输出
            // Tiptap 的 Markdown extension 负责解析常规 markdown
          },
        },
      },
    };
  },

  addAttributes() {
    return {
      emoji: {
        default: "💡",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "callout" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      setCallout:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name);
        },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^> \[\!\]\s$|^>\!\s$/,
        handler: ({ state, range, chain }) => {
          const $from = state.doc.resolve(range.from);
          if ($from.parentOffset > range.to - range.from) return null;

          chain().deleteRange(range).setNode(this.name).run();
        },
      }),
    ];
  },
});
