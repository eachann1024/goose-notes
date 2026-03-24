import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import { CommandList } from "@/pages/workspace/components/command/CommandList";
import { useSettings } from "@/stores/useSettings";
import {
  getAiToolbarItems,
  type AiToolbarActionItem,
} from "@/pages/workspace/components/command/aiActions";

const SPACE_AI_PLUGIN_KEY = new PluginKey("space-ai-toolbar");

function isSpaceAiAllowed({ state, range, editor }: any) {
  if (!useSettings.getState().ai.enabled) return false;
  if (!editor.isFocused || !state.selection.empty) return false;

  const $to = state.doc.resolve(range.to);
  if ($to.parent.type.name !== "paragraph") return false;
  if ($to.parent.type.spec.code) return false;
  if ($to.parentOffset !== $to.parent.textContent.length) return false;

  const text = $to.parent.textBetween(0, $to.parentOffset, null, "\ufffc");
  return /^\s\S*$/.test(text);
}

function findSpaceAiMatch({ $position }: { $position: any }) {
  if ($position.parent.type.name !== "paragraph") return null;
  if ($position.parent.type.spec.code) return null;
  if ($position.parentOffset === 0) return null;

  const text = $position.parent.textBetween(0, $position.parentOffset, null, "\ufffc");
  if (!/^\s\S*$/.test(text)) return null;

  return {
    range: {
      from: $position.start(),
      to: $position.pos,
    },
    query: text.slice(1),
    text,
  };
}

function filterItems(items: AiToolbarActionItem[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;

  return items.filter((item) => {
    const haystacks = [item.title, item.description, ...(item.keywords ?? [])].map((value) =>
      value.toLowerCase(),
    );
    return haystacks.some((value) => value.includes(normalized));
  });
}

export const SpaceAiToolbar = Extension.create({
  name: "spaceAiToolbar",

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: SPACE_AI_PLUGIN_KEY,
        editor: this.editor,
        char: " ",
        allowSpaces: false,
        findSuggestionMatch: findSpaceAiMatch,
        items: () => getAiToolbarItems(),
        allow: isSpaceAiAllowed,
        command: ({ editor, range, props }: any) => {
          props.command?.({ editor, range, props });
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: ReturnType<typeof tippy> | null = null;
          let executed = false;
          let latestProps: any;
          let stack: AiToolbarActionItem[] = [];

          const getCurrentItems = () => {
            const current = stack.at(-1)?.children ?? getAiToolbarItems();
            return filterItems(current, latestProps?.query ?? "");
          };

          const updateComponentProps = () => {
            if (!component) return;
            component.updateProps({
              ...latestProps,
              placement: "bottom",
              variant: "space-ai",
              title: stack.at(-1)?.title ?? "AI 写作",
              subtitle: stack.length > 0 ? "选择一个动作继续" : "空格唤起，继续输入可筛选",
              items: getCurrentItems(),
              onBack:
                stack.length > 0
                  ? () => {
                      stack = stack.slice(0, -1);
                      updateComponentProps();
                    }
                  : undefined,
            });
          };

          const cleanupQuery = () => {
            if (!latestProps?.editor || !latestProps?.range) return;
            const text = latestProps.editor.state.doc.textBetween(
              latestProps.range.from,
              latestProps.range.to,
              null,
              "\ufffc",
            );
            if (!/^\s\S*$/.test(text)) return;

            latestProps.editor.chain().focus().deleteRange(latestProps.range).run();
          };

          return {
            onStart: (props: any) => {
              latestProps = props;
              component = new ReactRenderer(CommandList, {
                props: {
                  ...props,
                  placement: "bottom",
                  variant: "space-ai",
                  title: "AI 写作",
                  subtitle: "空格唤起，继续输入可筛选",
                  items: getCurrentItems(),
                  command: async (item: AiToolbarActionItem) => {
                    if (item.children?.length) {
                      stack = [...stack, item];
                      updateComponentProps();
                      return;
                    }
                    if (!item.command) return;
                    executed = true;
                    await item.command({ editor: props.editor, range: props.range });
                  },
                },
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = tippy("body", {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
                arrow: false,
                maxWidth: "none",
                offset: [0, 8],
              });
            },
            onUpdate: (props: any) => {
              latestProps = props;
              updateComponentProps();
              popup?.[0]?.setProps({
                getReferenceClientRect: props.clientRect,
              });
            },
            onKeyDown: (props: any) => {
              latestProps = props;
              const nativeEvent = props.event as KeyboardEvent & {
                isComposing?: boolean;
                keyCode?: number;
              };
              const isImeComposing =
                nativeEvent.isComposing === true || nativeEvent.keyCode === 229;

              if (props.event.key === "Escape") {
                cleanupQuery();
                popup?.[0]?.hide();
                return true;
              }

              if (
                props.event.key === "Backspace" &&
                !isImeComposing &&
                props.query.length === 0 &&
                stack.length > 0
              ) {
                stack = stack.slice(0, -1);
                updateComponentProps();
                return true;
              }

              if (props.event.key === "ArrowLeft" && stack.length > 0) {
                stack = stack.slice(0, -1);
                updateComponentProps();
                return true;
              }

              return (component?.ref as any)?.onKeyDown?.(props) ?? false;
            },
            onExit: () => {
              popup?.[0]?.destroy();
              component?.destroy();
              popup = null;
              component = null;

              if (!executed) {
                cleanupQuery();
              }

              executed = false;
              stack = [];
              latestProps = null;
            },
          };
        },
      }),
    ];
  },
});

export const configureSpaceAiToolbar = () => SpaceAiToolbar.configure();
