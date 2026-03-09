import { Node, mergeAttributes, ReactNodeViewRenderer } from "@tiptap/react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import { InputRule } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Fragment } from "@tiptap/pm/model";
import { IconSelector } from "@/pages/workspace/components/shared/IconSelector";
import { cn } from "@/lib/utils";
import { getRandomBlockColorPair } from "@/lib/blockColorPresets";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: () => ReturnType;
    };
  }
}

const CalloutView = ({ node, updateAttributes }: any) => {
  const emoji = node.attrs.emoji || "💡";
  const blockTextColor = node.attrs.blockTextColor || undefined;
  const blockBgColor = node.attrs.blockBgColor || undefined;

  return (
    <NodeViewWrapper
      className={cn(
        "callout-node flex gap-3 p-4 my-4 rounded-[var(--goose-block-bg-radius)] border border-border/50 items-start group",
        !blockBgColor && "bg-muted/20",
      )}
      data-type="callout"
      data-block-text-color={blockTextColor}
      data-block-bg-color={blockBgColor}
    >
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
        <NodeViewContent className="callout-content outline-none w-full" />
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
          return commands.setNode(this.name, getRandomBlockColorPair());
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("callout-enter-exit"),
        props: {
          handleKeyDown: (view, event) => {
            if (
              event.key !== "Enter" ||
              event.shiftKey ||
              event.altKey ||
              event.ctrlKey ||
              event.metaKey ||
              event.isComposing ||
              view.composing
            ) {
              return false;
            }

            const { state, dispatch } = view;
            const { selection, schema } = state;

            if (!selection.empty || selection.$from.parent.type.name !== this.name) {
              return false;
            }

            const paragraphType = schema.nodes.paragraph;
            if (!paragraphType) return false;

            const calloutNode = selection.$from.parent;
            const calloutPos = selection.$from.before();
            const cursorOffset = selection.$from.parentOffset;
            const beforeContent = calloutNode.content.cut(0, cursorOffset);
            const afterContent = calloutNode.content.cut(
              cursorOffset,
              calloutNode.content.size,
            );

            const replacementNodes = [];

            if (beforeContent.size > 0) {
              replacementNodes.push(
                calloutNode.type.create(calloutNode.attrs, beforeContent),
              );
            }

            replacementNodes.push(
              paragraphType.create(
                null,
                afterContent.size > 0 ? afterContent : undefined,
              ),
            );

            const tr = state.tr.replaceWith(
              calloutPos,
              calloutPos + calloutNode.nodeSize,
              Fragment.fromArray(replacementNodes),
            );

            const paragraphPos =
              calloutPos +
              (replacementNodes.length === 2 ? replacementNodes[0].nodeSize : 0);

            tr.setSelection(TextSelection.near(tr.doc.resolve(paragraphPos + 1)));
            dispatch(tr.scrollIntoView());
            event.preventDefault();
            return true;
          },
        },
      }),
    ];
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^> \[\!\]\s$|^>\!\s$/,
        handler: ({ state, range, chain }) => {
          const $from = state.doc.resolve(range.from);
          if ($from.parentOffset > range.to - range.from) return null;

          chain()
            .deleteRange(range)
            .setNode(this.name, getRandomBlockColorPair())
            .run();
        },
      }),
    ];
  },
});
