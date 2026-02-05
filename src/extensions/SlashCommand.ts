import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import { CommandList } from "@/pages/workspace/components/command/CommandList";
import { getSuggestionItems } from "@/pages/workspace/components/command/commandItems";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { cn } from "@/lib/utils";

const TRIGGER_CHARS = ["/", "、"];

const findTriggerMatch = ({ $position }: { $position: any }) => {
  const text = $position.nodeBefore?.isText && $position.nodeBefore.text;
  if (!text) return null;

  const lastIndex = TRIGGER_CHARS.reduce((best, ch) => {
    const idx = text.lastIndexOf(ch);
    return idx > best ? idx : best;
  }, -1);

  if (lastIndex === -1) return null;

  const charBefore = lastIndex > 0 ? text[lastIndex - 1] : "";
  const isValidStart =
    charBefore === "" || charBefore === " " || charBefore === "\n";
  if (!isValidStart) return null;

  const query = text.slice(lastIndex + 1);
  if (query.includes(" ")) return null;

  const from = $position.pos - text.length + lastIndex;
  const to = $position.pos;

  return {
    range: { from, to },
    query,
    text: text.slice(lastIndex),
  };
};

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

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        findSuggestionMatch: ({ $position }: { $position: any }) =>
          findTriggerMatch({ $position }),
        allow: ({ state, range }: { state: any; range: any }) => {
          if (!this.editor.isFocused) {
            return false;
          }

          const { doc } = state;
          const $from = doc.resolve(range.from);
          const $to = doc.resolve(range.to);

          const textBefore = $from.parent.textBetween(
            Math.max(0, $from.parentOffset - 1),
            $from.parentOffset,
            null,
            "\ufffc",
          );

          const textAfterRange = $to.parent.textBetween(
            $to.parentOffset,
            $to.parent.content.size,
            null,
            "\ufffc",
          );

          const isValidStart =
            textBefore === "" || textBefore === " " || textBefore === "\n";

          return isValidStart && textAfterRange.trim().length === 0;
        },
      }),
      new Plugin({
        key: new PluginKey("slash-command-capsule"),
        props: {
          decorations: (state) => {
            if (!this.editor.isFocused || !state.selection.empty) {
              return DecorationSet.empty;
            }

            const { selection } = state;
            const { $from, to } = selection;

            const textBefore = $from.parent.textBetween(
              0,
              $from.parentOffset,
              null,
              "\ufffc",
            );
            const lastTriggerIndex = TRIGGER_CHARS.reduce((best, ch) => {
              const idx = textBefore.lastIndexOf(ch);
              return idx > best ? idx : best;
            }, -1);

            if (lastTriggerIndex === -1) return DecorationSet.empty;

            const textAfterCursor = $from.parent.textBetween(
              $from.parentOffset,
              $from.parent.content.size,
              null,
              "\ufffc",
            );

            const charBeforeTrigger =
              lastTriggerIndex > 0 ? textBefore[lastTriggerIndex - 1] : "";
            const isValidTrigger =
              charBeforeTrigger === "" ||
              charBeforeTrigger === " " ||
              charBeforeTrigger === "\n";

            if (isValidTrigger && textAfterCursor.trim().length === 0) {
              const textAfterTrigger = textBefore.slice(lastTriggerIndex + 1);
              const items = getSuggestionItems({ query: textAfterTrigger });
              const hasMatch = items.length > 0;

              if (hasMatch && !textAfterTrigger.includes(" ")) {
                const triggerPos = $from.start() + lastTriggerIndex;
                const isOnlyTrigger = textAfterTrigger.length === 0;

                return DecorationSet.create(state.doc, [
                  Decoration.inline(triggerPos, to, {
                    class: cn(
                      "slash-command-capsule",
                      isOnlyTrigger && "is-empty",
                    ),
                    "data-placeholder": "筛选...",
                  }),
                ]);
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
              props: { ...props, placement: "bottom" },
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
              onMount(instance) {
                const popperPlacement =
                  instance.popper?.getAttribute("data-placement") || "bottom";
                const placement = popperPlacement.startsWith("top")
                  ? "top"
                  : "bottom";
                component.updateProps({ ...props, placement });
              },
            });
          },

          onUpdate(props: any) {
            const instance = popup?.[0];
            const popperPlacement =
              instance?.popper?.getAttribute("data-placement") || "bottom";
            const placement = popperPlacement.startsWith("top")
              ? "top"
              : "bottom";
            component.updateProps({ ...props, placement });

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
            if (popup?.[0] && !popup[0].state?.isDestroyed) {
              popup[0].destroy();
            }
            component?.destroy();
          },
        };
      },
    },
  });
};
