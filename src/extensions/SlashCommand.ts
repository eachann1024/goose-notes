import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import { CommandList } from "@/pages/workspace/components/command/CommandList";
import { getSuggestionItems } from "@/pages/workspace/components/command/commandItems";
import { InputRule } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { cn } from "@/lib/utils";

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /、$/,
        handler: ({ state, range }) => {
          const { tr } = state;
          tr.insertText("/", range.from, range.to);
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        allow: ({ state, range }: { state: any; range: any }) => {
          const $from = state.doc.resolve(range.from);
          const textBefore = $from.parent.textBetween(
            Math.max(0, $from.parentOffset - 1),
            $from.parentOffset,
            null,
            "\ufffc",
          );

          const textAfter = $from.parent.textBetween(
            $from.parentOffset,
            $from.parent.content.size,
            null,
            "\ufffc",
          );

          return (
            (textBefore === "" || textBefore === " " || textBefore === "\n") &&
            textAfter.slice(1).trim().length === 0
          );
        },
      }),
      new Plugin({
        key: new PluginKey("slash-command-capsule"),
        props: {
          decorations: (state) => {
            const { selection } = state;
            const { $from, to } = selection;

            const textBefore = $from.parent.textBetween(
              0,
              $from.parentOffset,
              null,
              "\ufffc",
            );
            const lastSlashIndex = textBefore.lastIndexOf("/");

            const textAfter = $from.parent.textBetween(
              $from.parentOffset,
              $from.parent.content.size,
              null,
              "\ufffc",
            );

            if (lastSlashIndex !== -1 && textAfter.trim().length === 0) {
              const charBeforeSlash =
                lastSlashIndex > 0 ? textBefore[lastSlashIndex - 1] : "";
              const isValidTrigger =
                charBeforeSlash === "" ||
                charBeforeSlash === " " ||
                charBeforeSlash === "\n";

              if (isValidTrigger) {
                const textAfterSlash = textBefore.slice(lastSlashIndex + 1);

                const items = getSuggestionItems({ query: textAfterSlash });
                const hasMatch = items.length > 0;

                if (hasMatch && !textAfterSlash.includes(" ")) {
                  const slashPos = $from.start() + lastSlashIndex;
                  const isOnlySlash = textAfterSlash.length === 0;

                  return DecorationSet.create(state.doc, [
                    Decoration.inline(slashPos, to, {
                      class: cn(
                        "slash-command-capsule",
                        isOnlySlash && "is-empty",
                      ),
                      "data-placeholder": "筛选...",
                    }),
                  ]);
                }
              }
            }
            return DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

export const configureSlashCommand = () => {
  return SlashCommand.configure({
    suggestion: {
      items: getSuggestionItems,
      render: () => {
        let component: any;
        let popup: any;

        return {
          onStart: (props: any) => {
            component = new ReactRenderer(CommandList, {
              props,
              editor: props.editor,
            });

            if (!props.clientRect) {
              return;
            }

            popup = tippy("body", {
              getReferenceClientRect: props.clientRect,
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: "manual",
              placement: "bottom-start",
              arrow: false,
              theme: "notion-slash",
              offset: [0, 8],
            });
          },

          onUpdate(props: any) {
            component.updateProps(props);

            if (!props.clientRect) {
              return;
            }

            popup?.[0]?.setProps({
              getReferenceClientRect: props.clientRect,
            });
          },

          onKeyDown(props: any) {
            if (props.event.key === "Escape") {
              popup?.[0]?.hide();

              return true;
            }

            return component.ref?.onKeyDown(props);
          },

          onExit() {
            popup?.[0]?.destroy();
            component?.destroy();
          },
        };
      },
    },
  });
};
