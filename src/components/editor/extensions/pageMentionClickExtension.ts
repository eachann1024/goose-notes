import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { OpenPageOptions } from "@/components/editor/platform/hostContext";
import { isPlatformPrimaryModifierEvent } from "@/lib/shortcut-platform";
import { PAGE_MENTION_TYPE } from "@/components/editor/inline/pageMention";

export type PageMentionClickDeps = {
  openPage: (
    pageId: string,
    wikiTarget?: string,
    options?: OpenPageOptions,
  ) => boolean | void;
};

function mentionOpenFromTarget(
  target: EventTarget | null,
): { pageId: string; wikiTarget: string } | null {
  const el = target instanceof Element ? target : null;
  const mention = el?.closest<HTMLElement>(
    `[data-inline-content-type="${PAGE_MENTION_TYPE}"]`,
  );
  if (!mention) return null;
  const pageId =
    mention.getAttribute("data-page-id") ?? mention.dataset.pageId ?? "";
  const wikiTarget =
    mention.getAttribute("data-wiki-target") ?? mention.dataset.wikiTarget ?? "";
  const id = pageId.trim();
  const wiki = wikiTarget.trim();
  if (!id && !wiki) return null;
  return { pageId: id, wikiTarget: wiki };
}

function handleMentionOpen(
  event: MouseEvent,
  deps: PageMentionClickDeps,
): boolean {
  const open = mentionOpenFromTarget(event.target);
  if (!open) return false;
  const newTab = isPlatformPrimaryModifierEvent(event);
  const handled = deps.openPage(
    open.pageId,
    open.wikiTarget,
    newTab ? { newTab: true } : { splitOnly: true },
  );
  if (!newTab && handled === false) return false;
  event.preventDefault();
  return true;
}

const pluginKey = new PluginKey("goose-page-mention-click");

export const createPageMentionClickExtension = (deps: PageMentionClickDeps) =>
  createExtension({
    key: "goose-page-mention-click",
    prosemirrorPlugins: [
      new Plugin({
        key: pluginKey,
        props: {
          handleKeyDown(_view: EditorView, event: KeyboardEvent): boolean {
            if (event.key !== "Enter" || event.isComposing) return false;
            if (!document.querySelector('[data-notion-slash-root="true"]')) {
              return false;
            }
            return true;
          },
          handleClick(view: EditorView, _pos: number, event: MouseEvent): boolean {
            return handleMentionOpen(event, deps);
          },
          handleClickOn(
            view: EditorView,
            _pos: number,
            _node: unknown,
            _nodePos: number,
            event: MouseEvent,
          ): boolean {
            return handleMentionOpen(event, deps);
          },
        },
        view(view: EditorView) {
          const syncArmed = (event: KeyboardEvent) => {
            view.dom.classList.toggle(
              "goose-page-mention-armed",
              isPlatformPrimaryModifierEvent(event),
            );
          };
          const disarm = () =>
            view.dom.classList.remove("goose-page-mention-armed");
          const onVisibility = () => {
            if (document.hidden) disarm();
          };
          window.addEventListener("keydown", syncArmed);
          window.addEventListener("keyup", syncArmed);
          window.addEventListener("blur", disarm);
          document.addEventListener("visibilitychange", onVisibility);
          return {
            destroy() {
              window.removeEventListener("keydown", syncArmed);
              window.removeEventListener("keyup", syncArmed);
              window.removeEventListener("blur", disarm);
              document.removeEventListener("visibilitychange", onVisibility);
              disarm();
            },
          };
        },
      }),
    ],
  });
