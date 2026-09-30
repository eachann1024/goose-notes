import type { BlockNoteEditor } from "@blocknote/core";
import { clearFind, setFindQuery } from "@/components/editor/find/findInPagePlugin";
import {
  findCollapsedHeadingsHidingBlock,
  type SectionFoldBlock,
} from "@/components/editor/core/headingSectionFold";

/**
 * 全局搜索「跳转即定位」。
 *
 * 搜索结果只带 query 字符串、不带 blockId，所以这里用 query 在当前页重新定位：
 * 1. 找到第一个匹配文本所在的 DOM。
 * 2. 把它前方收起的标题章节展开（props.collapsed → false）。
 * 3. 等折叠展开触发的重渲染落定后，复用页内查找的 setFindQuery 做高亮 + 滚动到匹配。
 * 4. 高亮几秒后自动淡出。
 */

const HIGHLIGHT_FADE_DELAY = 2600;
const FADE_DURATION = 600;

const BLOCK_CONTAINER_SELECTOR = '[data-node-type="blockContainer"]';

let fadeTimer: ReturnType<typeof setTimeout> | null = null;

function getView(editor: BlockNoteEditor<any, any, any>) {
  // Tiptap 在 unmount 后仍会返回一个延迟报错的 view proxy；读取 dom 才会抛错。
  // isDestroyed 同时覆盖未挂载和已销毁，因此必须先做这个生命周期判断。
  if (editor._tiptapEditor.isDestroyed) return null;
  return (editor.prosemirrorView as import("prosemirror-view").EditorView | undefined) ?? null;
}

function findFirstMatchElement(
  root: HTMLElement,
  query: string,
): HTMLElement | null {
  const needle = query.toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    const text = node.textContent;
    if (text && text.toLowerCase().includes(needle)) {
      return (node.parentElement as HTMLElement) ?? null;
    }
    node = walker.nextNode();
  }
  return null;
}

function resolveBlockId(matchEl: HTMLElement): string | null {
  const container = matchEl.closest(BLOCK_CONTAINER_SELECTOR);
  const blockOuter = container?.closest("[data-id]") ?? matchEl.closest("[data-id]");
  return blockOuter?.getAttribute("data-id") ?? null;
}

function expandCollapsedHeadingSections(
  editor: BlockNoteEditor<any, any, any>,
  matchEl: HTMLElement,
): boolean {
  const blockId = resolveBlockId(matchEl);
  if (!blockId) return false;

  const firstBlockId = editor.document[0]?.id as string | undefined;
  const headingIds = findCollapsedHeadingsHidingBlock(
    editor.document as SectionFoldBlock[],
    blockId,
    firstBlockId,
  );
  if (headingIds.length === 0) return false;

  headingIds.forEach((headingId) => {
    const heading = editor.getBlock(headingId);
    if (heading?.type === "heading") {
      editor.updateBlock(heading, { props: { collapsed: false } });
    }
  });
  return true;
}

function scheduleFade(editor: BlockNoteEditor<any, any, any>) {
  if (fadeTimer) clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => {
    fadeTimer = null;
    const view = getView(editor);
    const root = view?.dom as HTMLElement | undefined;
    const marks = root?.querySelectorAll<HTMLElement>(".goose-find-match");
    if (marks && marks.length > 0) {
      marks.forEach((m) => m.classList.add("goose-find-match--fading"));
      setTimeout(() => {
        if (!getView(editor)) return;
        clearFind(editor);
      }, FADE_DURATION);
    } else {
      clearFind(editor);
    }
  }, HIGHLIGHT_FADE_DELAY);
}

export function locateAndHighlight(
  editor: BlockNoteEditor<any, any, any>,
  query: string,
) {
  const trimmed = query.trim();
  if (!trimmed) return;
  const view = getView(editor);
  if (!view) return;

  const root = view.dom as HTMLElement;
  const matchEl = findFirstMatchElement(root, trimmed);
  const expanded = matchEl ? expandCollapsedHeadingSections(editor, matchEl) : false;

  const run = () => {
    if (!getView(editor)) return;
    setFindQuery(editor, trimmed, false);
    settleScroll(editor);
    scheduleFade(editor);
  };

  if (expanded) {
    requestAnimationFrame(() => requestAnimationFrame(run));
  } else {
    run();
  }
}

function settleScroll(editor: BlockNoteEditor<any, any, any>) {
  const deadline = 600;
  const interval = 60;
  let elapsed = 0;

  const tick = () => {
    const v = getView(editor);
    const dom = v?.dom as HTMLElement | undefined;
    const target =
      dom?.querySelector<HTMLElement>(".goose-find-match--current") ??
      dom?.querySelector<HTMLElement>(".goose-find-match") ??
      null;

    if (target) {
      const scroller = getScrollParent(target);
      if (scroller) {
        const tr = target.getBoundingClientRect();
        const sr = scroller.getBoundingClientRect();
        const inView = tr.top >= sr.top && tr.bottom <= sr.bottom;
        if (!inView) {
          const next =
            scroller.scrollTop + (tr.top - sr.top) - sr.height / 2 + tr.height / 2;
          scroller.scrollTop = Math.max(0, next);
        } else if (elapsed >= interval) {
          return;
        }
      }
    }

    elapsed += interval;
    if (elapsed < deadline) setTimeout(tick, interval);
  };

  setTimeout(tick, 0);
}

function getScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    const oy = style.overflowY;
    if (
      (oy === "auto" || oy === "scroll" || oy === "overlay") &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}
