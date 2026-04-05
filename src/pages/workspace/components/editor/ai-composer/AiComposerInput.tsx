import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import type { EditorView } from "@tiptap/pm/view";
import { EditorContent, ReactRenderer, useEditor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import Suggestion, { SuggestionPluginKey } from "@tiptap/suggestion";
import { mergeAttributes, Node } from "@tiptap/core";
import tippy from "tippy.js";
import type { Instance, Props } from "tippy.js";
import { cn } from "@/lib/utils";
import { AiReferenceList } from "./AiReferenceList";
import {
  getAiReferenceSuggestionItems,
  serializeAiComposerDoc,
  type AiComposerPayload,
  type AiFileReferenceAttrs,
  type AiReferenceSuggestionItem,
} from "./referenceLookup";
import type { JSONContent } from "@/types";

const EMPTY_AI_COMPOSER_CONTENT = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const AI_FILE_REFERENCE_NODE_NAME = "aiFileReference";

function insertHardBreak(
  view: EditorView,
  dispatch: ((tr: Parameters<EditorView["dispatch"]>[0]) => void) | undefined,
) {
  const hardBreak = view.state.schema.nodes.hardBreak;
  if (!hardBreak || !dispatch) return false;

  dispatch(
    view.state.tr.replaceSelectionWith(hardBreak.create()).scrollIntoView(),
  );
  return true;
}

function deleteAdjacentReference(
  view: EditorView,
  direction: "backward" | "forward",
) {
  const { state, dispatch } = view;
  const { selection } = state;
  if (!selection.empty || !dispatch) return false;

  const anchor = selection.$from;
  const targetNode =
    direction === "backward" ? anchor.nodeBefore : anchor.nodeAfter;
  if (targetNode?.type.name !== AI_FILE_REFERENCE_NODE_NAME) {
    return false;
  }

  const from =
    direction === "backward" ? anchor.pos - targetNode.nodeSize : anchor.pos;
  const to =
    direction === "backward" ? anchor.pos : anchor.pos + targetNode.nodeSize;

  dispatch(state.tr.delete(from, to).scrollIntoView());
  return true;
}

function createAiFileReferenceExtension(
  onReferenceAdded: ((reference: AiFileReferenceAttrs) => void) | undefined,
) {
  return Node.create({
    name: AI_FILE_REFERENCE_NODE_NAME,

    inline: true,

    group: "inline",

    atom: true,

    selectable: false,

    addAttributes() {
      return {
        pageId: {
          default: "",
        },
        workspaceId: {
          default: "",
        },
        titleSnapshot: {
          default: "未命名文件",
        },
        sourceType: {
          default: "app-page",
        },
        localFilePath: {
          default: null,
        },
        notebookNameSnapshot: {
          default: "",
        },
        locationSnapshot: {
          default: "",
        },
      };
    },

    parseHTML() {
      return [{ tag: 'span[data-type="ai-file-reference"]' }];
    },

    renderHTML({ HTMLAttributes, node }) {
      const showSourceLabel = node.attrs.sourceType === "local-file";

      return [
        "span",
        mergeAttributes(HTMLAttributes, {
          "data-type": "ai-file-reference",
          contenteditable: "false",
          class:
            "ai-file-reference-chip relative inline-flex h-6 max-w-[200px] select-none items-center gap-1 rounded-[12px] border border-border/80 bg-muted/75 px-2 align-middle text-[11px] font-medium leading-none text-foreground shadow-sm ml-1 mr-2 top-[1px]",
        }),
        [
          "span",
          {
            class:
              "max-w-[132px] truncate text-[11px] font-medium text-foreground",
          },
          node.attrs.titleSnapshot || "未命名文件",
        ],
        ...(showSourceLabel
          ? [[
              "span",
              {
                "data-ai-reference-source-label": "true",
                class:
                  "shrink-0 rounded-full border border-border/70 bg-background/85 px-1.5 py-[3px] text-[9px] font-medium text-muted-foreground",
              },
              "本地",
            ]]
          : []),
      ];
    },

    renderText({ node }) {
      return `@${node.attrs.titleSnapshot || "未命名文件"}`;
    },

    addProseMirrorPlugins() {
      return [
        Suggestion<AiReferenceSuggestionItem>({
          editor: this.editor,
          char: "@",
          allowSpaces: true,
          items: ({ query }) => getAiReferenceSuggestionItems(query),
          command: ({ editor, range, props }) => {
            const finalAttrs = {
              pageId: props.pageId,
              workspaceId: props.workspaceId,
              titleSnapshot: props.titleSnapshot,
              localFilePath: props.localFilePath,
              notebookNameSnapshot: props.notebookNameSnapshot,
              locationSnapshot: props.locationSnapshot,
              sourceType: props.sourceType,
            } satisfies AiFileReferenceAttrs;

            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent({
                type: AI_FILE_REFERENCE_NODE_NAME,
                attrs: finalAttrs,
              })
              .run();

            onReferenceAdded?.(finalAttrs);
          },
          render: () => {
            let component: ReactRenderer<any> | null = null;
            let popup: Instance<Props> | null = null;
            let latestProps: {
              clientRect?: (() => DOMRect | null) | null;
              editor: any;
              items: AiReferenceSuggestionItem[];
            } | null = null;

            const getPlacement = () =>
              popup?.popper?.getAttribute("data-placement")?.startsWith("top")
                ? "top"
                : "bottom";

            const syncPlacement = () => {
              if (!latestProps || !component) return;
              component.updateProps({
                ...latestProps,
                placement: getPlacement(),
              });
            };

            const ensureComponent = (props: {
              clientRect?: (() => DOMRect | null) | null;
              editor: any;
              items: AiReferenceSuggestionItem[];
            }) => {
              if (!component) {
                component = new ReactRenderer(AiReferenceList, {
                  props: { ...props, placement: "bottom" },
                  editor: props.editor,
                });
              }
            };

            const ensurePopup = (props: {
              clientRect?: (() => DOMRect | null) | null;
            }) => {
              if (!popup && props.clientRect && component) {
                popup = tippy(document.body, {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                  arrow: false,
                  theme: "notion-slash",
                  offset: [0, 8],
                  onMount: syncPlacement,
                  onAfterUpdate: syncPlacement,
                }) as Instance<Props>;
              }
            };

            return {
              onStart: (props) => {
                latestProps = props;
                ensureComponent(props);
                if (props.items.length) {
                  ensurePopup(props);
                  syncPlacement();
                }
              },

              onUpdate: (props) => {
                latestProps = props;
                ensureComponent(props);
                if (!props.items.length) {
                  if (popup && !popup.state?.isDestroyed) {
                    popup.destroy();
                  }
                  popup = null;
                  component?.updateProps({
                    ...props,
                    placement: "bottom",
                  });
                  return;
                }

                ensurePopup(props);
                syncPlacement();

                if (!props.clientRect) return;

                popup?.setProps({
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                });
              },

              onKeyDown: (props) => {
                const nativeEvent = props.event as KeyboardEvent & {
                  isComposing?: boolean;
                  keyCode?: number;
                };
                if (nativeEvent.isComposing || nativeEvent.keyCode === 229) {
                  return false;
                }

                if (props.event.key === "Escape") {
                  popup?.hide();
                  return true;
                }

                return component?.ref?.onKeyDown(props) ?? false;
              },

              onExit: () => {
                if (popup && !popup.state?.isDestroyed) {
                  popup.destroy();
                }
                popup = null;
                component?.destroy();
                component = null;
              },
            };
          },
        }),
      ];
    },
  });
}

export interface AiComposerInputHandle {
  focus: () => void;
  clear: () => void;
  getPayload: () => AiComposerPayload;
}

interface AiComposerInputProps {
  placeholder: string;
  placeholderOverlayText?: string;
  autoFocusToken: number;
  onSubmit: () => void;
  onEscape: () => void;
  initialContent?: JSONContent | null;
  onContentChange?: (content: JSONContent | null) => void;
  onIsEmptyChange?: (isEmpty: boolean) => void;
  onReferenceAdded?: (reference: AiFileReferenceAttrs) => void;
  variant?: "compact" | "panel";
  compactWidthClass?: string;
}

export const AiComposerInput = forwardRef<
  AiComposerInputHandle,
  AiComposerInputProps
>(
  (
    {
      placeholder,
      placeholderOverlayText,
      autoFocusToken,
      onSubmit,
      onEscape,
      initialContent,
      onContentChange,
      onIsEmptyChange,
      onReferenceAdded,
      variant = "compact",
      compactWidthClass,
    },
    ref,
  ) => {
    const [isEmpty, setIsEmpty] = useState(true);
    const extensions = useMemo(
      () => [
        StarterKit.configure({
          blockquote: false,
          bulletList: false,
          code: false,
          codeBlock: false,
          dropcursor: false,
          gapcursor: false,
          heading: false,
          horizontalRule: false,
          listItem: false,
          orderedList: false,
        }),
        Placeholder.configure({
          placeholder: placeholderOverlayText ? "" : placeholder,
        }),
        createAiFileReferenceExtension(onReferenceAdded),
      ],
      [onReferenceAdded, placeholder, placeholderOverlayText],
    );

    const composerEditor = useEditor({
      extensions,
      content: initialContent ?? EMPTY_AI_COMPOSER_CONTENT,
      editorProps: {
        attributes: {
          "aria-label": "AI 输入",
          "data-ai-composer-editor": "true",
          "data-ai-composer-variant": variant,
          class: cn(
            variant === "panel"
              ? "ai-composer-editor min-h-[56px] max-h-[144px] overflow-y-auto bg-transparent px-0 pt-0 pb-0 text-[13px] leading-6 text-foreground outline-none"
              : "ai-composer-editor min-h-[20px] max-h-[88px] overflow-y-auto bg-transparent px-0 pt-0 pb-0 text-[12px] leading-[20px] text-foreground outline-none",
            variant === "panel"
              ? "break-words whitespace-pre-wrap"
              : "break-words whitespace-pre-wrap",
            variant === "panel"
              ? "min-h-[56px] whitespace-pre-wrap break-words text-[13px] leading-6"
              : "min-h-[20px] whitespace-pre-wrap break-words text-[12px] leading-[20px]",
            "[&_p]:m-0 [&_ul]:my-0 [&_ul]:pl-0 [&_ol]:my-0 [&_ol]:pl-0",
            "[&_ul>li::before]:hidden [&_ol>li::before]:static [&_ol>li::before]:mr-1",
            "[&_ul[data-type='taskList']]:pl-0 [&_ul[data-type='taskList']_li>label]:static [&_ul[data-type='taskList']_li>label]:mr-1.5 [&_ul[data-type='taskList']_li>label]:inline-flex",
            "[&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0",
            "[&_.is-editor-empty:first-child::before]:text-muted-foreground/60 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          ),
        },
        handleKeyDown: (view, event) => {
          if (event.isComposing || event.keyCode === 229) return false;

          const suggestionState = SuggestionPluginKey.getState(view.state) as
            | { active?: boolean }
            | undefined;

          if (event.key === "Enter") {
            if (suggestionState?.active) {
              return false;
            }

            event.preventDefault();

            if (event.shiftKey) {
              return insertHardBreak(view, view.dispatch);
            }

            onSubmit();
            return true;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            onEscape();
            return true;
          }

          if (event.key === "Backspace") {
            return deleteAdjacentReference(view, "backward");
          }

          if (event.key === "Delete") {
            return deleteAdjacentReference(view, "forward");
          }

          return false;
        },
      },
      onUpdate: ({ editor }) => {
        const nextContent = editor.getJSON();
        const payload = serializeAiComposerDoc(nextContent);
        const nextIsEmpty =
          !payload.promptText.trim() &&
            payload.references.length === 0;
        setIsEmpty(nextIsEmpty);
        onIsEmptyChange?.(nextIsEmpty);
        onContentChange?.(nextContent);
      },
      immediatelyRender: false,
    });

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          composerEditor?.commands.focus("end");
        },
        clear: () => {
          composerEditor?.commands.setContent(EMPTY_AI_COMPOSER_CONTENT, {
            emitUpdate: false,
          });
          setIsEmpty(true);
          onIsEmptyChange?.(true);
        },
        getPayload: () => serializeAiComposerDoc(composerEditor?.getJSON()),
      }),
      [composerEditor],
    );

    useEffect(() => {
      if (!composerEditor) return;
      composerEditor.commands.focus("end");
    }, [autoFocusToken, composerEditor]);

    useEffect(() => {
      if (!composerEditor) return;

      const nextContent = initialContent ?? EMPTY_AI_COMPOSER_CONTENT;
      const current = JSON.stringify(composerEditor.getJSON());
      const next = JSON.stringify(nextContent);
      if (current === next) return;

      composerEditor.commands.setContent(nextContent, {
        emitUpdate: false,
      });
      const payload = serializeAiComposerDoc(nextContent);
      setIsEmpty(
        !payload.promptText.trim() &&
          payload.references.length === 0,
      );
    }, [composerEditor, initialContent]);

    useEffect(() => {
      if (!composerEditor) return;
      const payload = serializeAiComposerDoc(composerEditor.getJSON());
      setIsEmpty(
        !payload.promptText.trim() &&
          payload.references.length === 0,
      );
    }, [composerEditor]);

    return (
      <div
        className={cn(
          "relative min-w-0 flex-1",
          variant === "panel" ? "w-full px-0" : compactWidthClass,
        )}
      >
        {placeholderOverlayText && isEmpty ? (
          <div
            className={cn(
              "pointer-events-none absolute left-0 right-0 z-[1] text-muted-foreground/60",
              variant === "panel"
                ? "top-0 line-clamp-3 pr-10 text-[13px] leading-6"
                : "top-0 pr-8 text-[12px] leading-[20px]",
            )}
          >
            {placeholderOverlayText}
          </div>
        ) : null}
        <EditorContent editor={composerEditor} />
      </div>
    );
  },
);

AiComposerInput.displayName = "AiComposerInput";
