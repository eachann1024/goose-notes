import { Extension } from "@tiptap/core";
import Suggestion, { findSuggestionMatch, SuggestionPluginKey } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import { SlashCommandList } from "@/pages/workspace/components/command/SlashCommandList";
import { getSuggestionItems } from "@/pages/workspace/components/command/commandItems";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { cn } from "@/lib/utils";
import { useSettings } from "@/stores/useSettings";

const TRIGGER_CHARS = ["/", "、"];
const DEFAULT_ALLOWED_PREFIXES: string[] | null = null;

const isValidTriggerPrefix = (charBefore: string) =>
  charBefore === "" || charBefore === " " || charBefore === "\n";

const getTriggerChar = (doc: any, from: number) =>
  doc.textBetween(from, from + 1, null, "\ufffc");

const isAllowedTriggerContext = ({
  doc,
  from,
  $cursor,
}: {
  doc: any;
  from: number;
  $cursor: any;
}) => {
  if ($cursor.parent.type.spec.code) {
    return false;
  }

  const $triggerFrom = doc.resolve(from);
  const triggerChar = getTriggerChar(doc, from);

  if (triggerChar === "、") {
    return $triggerFrom.parentOffset === 0;
  }

  const textBeforeTrigger = $triggerFrom.parent.textBetween(
    Math.max(0, $triggerFrom.parentOffset - 1),
    $triggerFrom.parentOffset,
    null,
    "\ufffc",
  );

  return isValidTriggerPrefix(textBeforeTrigger);
};

const findTriggerMatch = ({
  $position,
  allowSpaces = false,
  allowToIncludeChar = false,
  allowedPrefixes = DEFAULT_ALLOWED_PREFIXES,
  startOfLine = false,
}: {
  $position: any;
  allowSpaces?: boolean;
  allowToIncludeChar?: boolean;
  allowedPrefixes?: string[] | null;
  startOfLine?: boolean;
}) => {
  let bestMatch: any = null;

  for (const char of TRIGGER_CHARS) {
    const match = findSuggestionMatch({
      char,
      allowSpaces,
      allowToIncludeChar,
      allowedPrefixes,
      startOfLine,
      $position,
    });

    if (!match) continue;

    if (!bestMatch || match.range.from > bestMatch.range.from) {
      bestMatch = match;
    }
  }

  return bestMatch;
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

  addKeyboardShortcuts() {
    return {
      /**
       * 修复退格无法删除斜杠：
       * 当 suggestion 处于活跃状态且 query 为空（光标紧贴 `/` 后面），
       * 主动删除触发字符，让菜单自然关闭。
       */
      Backspace: () => {
        const { editor } = this;
        const { state } = editor;

        const suggestionState = SuggestionPluginKey.getState(state) as
          | { active?: boolean; query?: string; range?: { from: number; to: number } }
          | undefined;

        if (!suggestionState?.active) return false;

        // query 为空说明光标紧跟在触发字符后，需要删除触发字符
        if ((suggestionState.query ?? "") === "") {
          const range = suggestionState.range;
          if (!range) return false;
          editor.chain().focus().deleteRange(range).run();
          return true;
        }

        return false;
      },

      /**
       * 空格触发 AI（仅当 AI 功能已启用）：
       * 在完全空的段落中按空格键时，触发 AI 输入弹窗，而不是插入空格。
       */
      Space: () => {
        const { editor } = this;
        if (!useSettings.getState().ai.enabled) return false;

        const { state } = editor;
        const { selection } = state;
        const { $from, empty } = selection;

        // 只在空段落且光标在段落开头时触发
        if (
          !empty ||
          $from.parent.type.name !== "paragraph" ||
          $from.parent.content.size !== 0
        ) {
          return false;
        }

        document.dispatchEvent(
          new CustomEvent("open-ai-input-popover", { detail: { editor, triggeredBy: "space" } }),
        );
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const suggestionMatcherOptions = {
      allowSpaces: this.options.suggestion.allowSpaces ?? false,
      allowToIncludeChar: this.options.suggestion.allowToIncludeChar ?? false,
      allowedPrefixes:
        this.options.suggestion.allowedPrefixes ?? DEFAULT_ALLOWED_PREFIXES,
      startOfLine: this.options.suggestion.startOfLine ?? false,
    };

    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        findSuggestionMatch: ({ $position }: { $position: any }) =>
          findTriggerMatch({ $position, ...suggestionMatcherOptions }),
        allow: ({ state, range }: { state: any; range: any }) => {
          if (!this.editor.isFocused) {
            return false;
          }

          const { doc } = state;
          const $to = doc.resolve(range.to);
          const isAtBlockEnd = $to.parentOffset === $to.parent.content.size;

          return (
            isAllowedTriggerContext({
              doc,
              from: range.from,
              $cursor: $to,
            }) && isAtBlockEnd
          );
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

            const match = findTriggerMatch({
              $position: $from,
              ...suggestionMatcherOptions,
            });

            if (!match) return DecorationSet.empty;

            const isAtBlockEnd = $from.parentOffset === $from.parent.content.size;

            if (
              !isAllowedTriggerContext({
                doc: state.doc,
                from: match.range.from,
                $cursor: $from,
              }) ||
              !isAtBlockEnd
            ) {
              return DecorationSet.empty;
            }

            const items = getSuggestionItems({ query: match.query });
            const hasMatch = items.length > 0;

            if (!hasMatch) return DecorationSet.empty;

            const isOnlyTrigger = match.query.length === 0;

            return DecorationSet.create(state.doc, [
              Decoration.inline(match.range.from, to, {
                class: cn("slash-command-capsule", isOnlyTrigger && "is-empty"),
                "data-placeholder": "筛选...",
              }),
            ]);
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
            // 使用独立的 SlashCommandList 而非通用的 CommandList，防止样式互相影响
            component = new ReactRenderer(SlashCommandList, {
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
