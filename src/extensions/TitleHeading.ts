import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, Selection, Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { moveSelectionToBlockBoundary } from "@/extensions/blockBoundarySelection";

export const TitleHeading = Extension.create({
  name: "titleHeading",

  addProseMirrorPlugins() {
    type FrozenScrollTarget = {
      node: HTMLElement;
      top: number;
      left: number;
      prevOverflow: string;
      prevOverflowX: string;
      prevOverflowY: string;
      prevOverflowAnchor: string;
      prevOverscrollBehavior: string;
      prevScrollBehavior: string;
    };

    let composingInTitle = false;
    let titleTextBeforeComposition = "";
    let suppressImeConfirmKeyUntil = 0;
    let imeConfirmGuardCleanupTimer: number | null = null;
    let imeConfirmGuardHandler: ((event: KeyboardEvent) => void) | null = null;
    let imeScrollLockReleaseTimer: number | null = null;
    let suppressBeforeInputInsertParagraphUntil = 0;
    let scrollFreezeFallbackTimer: number | null = null;
    let scrollFreezeRaf: number | null = null;
    let imeScrollRestoreTimers: number[] = [];
    let hasHandledFirstTitleImeConfirm = false;
    let frozenScrollTargets: FrozenScrollTarget[] = [];
    let frozenWindowTop = 0;
    let frozenWindowLeft = 0;
    let scrollFreezeHandler: (() => void) | null = null;

    const isSelectionInTitle = (view: EditorView) => {
      try {
        return view.state.selection.$from.before(1) === 0;
      } catch {
        return false;
      }
    };

    const isImeConfirmKey = (event: KeyboardEvent) => {
      const key = event.key || "";
      const code = event.code || "";
      const keyCode = Number(event.keyCode || event.which || 0);
      return (
        key === " " ||
        key === "Spacebar" ||
        code === "Space" ||
        key === "Enter" ||
        key === "Process" ||
        key === "Unidentified" ||
        code.startsWith("Digit") ||
        /^[0-9]$/.test(key) ||
        keyCode === 32 ||
        keyCode === 13 ||
        keyCode === 229 ||
        (keyCode >= 48 && keyCode <= 57)
      );
    };

    const cleanupImeConfirmGuard = () => {
      if (imeConfirmGuardHandler) {
        window.removeEventListener("keydown", imeConfirmGuardHandler, true);
        imeConfirmGuardHandler = null;
      }
      if (imeConfirmGuardCleanupTimer !== null) {
        window.clearTimeout(imeConfirmGuardCleanupTimer);
        imeConfirmGuardCleanupTimer = null;
      }
    };

    const setImeScrollLock = (view: EditorView, enabled: boolean) => {
      if (enabled) {
        view.dom.dataset.imeScrollLock = "1";
      } else {
        delete view.dom.dataset.imeScrollLock;
      }
    };

    const cleanupScrollFreeze = () => {
      if (scrollFreezeRaf !== null) {
        window.cancelAnimationFrame(scrollFreezeRaf);
        scrollFreezeRaf = null;
      }
      if (scrollFreezeFallbackTimer !== null) {
        window.clearTimeout(scrollFreezeFallbackTimer);
        scrollFreezeFallbackTimer = null;
      }
      if (scrollFreezeHandler) {
        window.removeEventListener("scroll", scrollFreezeHandler);
        frozenScrollTargets.forEach(({ node }) => {
          node.removeEventListener("scroll", scrollFreezeHandler as EventListener);
        });
      }
      frozenScrollTargets.forEach((target) => {
        target.node.style.overflow = target.prevOverflow;
        target.node.style.overflowX = target.prevOverflowX;
        target.node.style.overflowY = target.prevOverflowY;
        target.node.style.overflowAnchor = target.prevOverflowAnchor;
        target.node.style.overscrollBehavior = target.prevOverscrollBehavior;
        target.node.style.scrollBehavior = target.prevScrollBehavior;
      });
      frozenScrollTargets = [];
      scrollFreezeHandler = null;
    };

    const clearImeScrollRestoreTimers = () => {
      if (!imeScrollRestoreTimers.length) return;
      imeScrollRestoreTimers.forEach((timer) => {
        window.clearTimeout(timer);
      });
      imeScrollRestoreTimers = [];
    };

    const armImeConfirmGuard = () => {
      cleanupImeConfirmGuard();
      imeConfirmGuardHandler = (event: KeyboardEvent) => {
        if (Date.now() > suppressImeConfirmKeyUntil) {
          cleanupImeConfirmGuard();
          return;
        }
        if (!isImeConfirmKey(event)) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        cleanupImeConfirmGuard();
      };
      window.addEventListener("keydown", imeConfirmGuardHandler, true);
      imeConfirmGuardCleanupTimer = window.setTimeout(() => {
        cleanupImeConfirmGuard();
      }, 32);
    };

    const getScrollContainer = (view: EditorView) => {
      return (
        (view.dom.closest(".page-scroll-container") as HTMLElement | null) ??
        null
      );
    };

    const captureScrollSnapshot = (view: EditorView) => {
      const container = getScrollContainer(view);
      const docScroller = document.scrollingElement as HTMLElement | null;
      return {
        container,
        containerTop: container?.scrollTop ?? 0,
        containerLeft: container?.scrollLeft ?? 0,
        docScroller,
        docTop: docScroller?.scrollTop ?? 0,
        docLeft: docScroller?.scrollLeft ?? 0,
        windowTop: window.scrollY,
        windowLeft: window.scrollX,
      };
    };

    const restoreScrollSnapshot = (snapshot: ReturnType<typeof captureScrollSnapshot>) => {
      const {
        container,
        containerTop,
        containerLeft,
        docScroller,
        docTop,
        docLeft,
        windowTop,
        windowLeft,
      } = snapshot;

      if (container) {
        container.scrollTop = containerTop;
        container.scrollLeft = containerLeft;
      }

      if (docScroller) {
        docScroller.scrollTop = docTop;
        docScroller.scrollLeft = docLeft;
      }

      if (
        Math.abs(window.scrollY - windowTop) > 1 ||
        Math.abs(window.scrollX - windowLeft) > 1
      ) {
        window.scrollTo(windowLeft, windowTop);
      }
    };

    const scheduleImeScrollRestore = (
      snapshot: ReturnType<typeof captureScrollSnapshot>,
      delays = [0, 16, 48, 96, 180, 320, 520],
    ) => {
      clearImeScrollRestoreTimers();
      delays.forEach((delay) => {
        const timer = window.setTimeout(() => {
          restoreScrollSnapshot(snapshot);
        }, delay);
        imeScrollRestoreTimers.push(timer);
      });
      requestAnimationFrame(() => {
        restoreScrollSnapshot(snapshot);
        requestAnimationFrame(() => {
          restoreScrollSnapshot(snapshot);
        });
      });
    };

    const isScrollable = (node: HTMLElement) => {
      const style = window.getComputedStyle(node);
      const overflowY = style.overflowY;
      const overflowX = style.overflowX;
      const canScrollY =
        (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
        node.scrollHeight > node.clientHeight + 1;
      const canScrollX =
        (overflowX === "auto" || overflowX === "scroll" || overflowX === "overlay") &&
        node.scrollWidth > node.clientWidth + 1;
      return canScrollY || canScrollX;
    };

    const collectScrollableTargets = (view: EditorView) => {
      const targets: FrozenScrollTarget[] = [];
      const seen = new Set<HTMLElement>();
      let node = view.dom.parentElement;
      while (node) {
        if (isScrollable(node) && !seen.has(node)) {
          seen.add(node);
          targets.push({
            node,
            top: node.scrollTop,
            left: node.scrollLeft,
            prevOverflow: node.style.overflow,
            prevOverflowX: node.style.overflowX,
            prevOverflowY: node.style.overflowY,
            prevOverflowAnchor: node.style.overflowAnchor,
            prevOverscrollBehavior: node.style.overscrollBehavior,
            prevScrollBehavior: node.style.scrollBehavior,
          });
        }
        node = node.parentElement;
      }

      const docScroller = document.scrollingElement as HTMLElement | null;
      if (
        docScroller &&
        !seen.has(docScroller) &&
        (isScrollable(docScroller) ||
          docScroller.scrollTop !== 0 ||
          docScroller.scrollLeft !== 0)
      ) {
        seen.add(docScroller);
        targets.push({
          node: docScroller,
          top: docScroller.scrollTop,
          left: docScroller.scrollLeft,
          prevOverflow: docScroller.style.overflow,
          prevOverflowX: docScroller.style.overflowX,
          prevOverflowY: docScroller.style.overflowY,
          prevOverflowAnchor: docScroller.style.overflowAnchor,
          prevOverscrollBehavior: docScroller.style.overscrollBehavior,
          prevScrollBehavior: docScroller.style.scrollBehavior,
        });
      }

      const body = document.body as HTMLElement | null;
      if (body && !seen.has(body) && isScrollable(body)) {
        targets.push({
          node: body,
          top: body.scrollTop,
          left: body.scrollLeft,
          prevOverflow: body.style.overflow,
          prevOverflowX: body.style.overflowX,
          prevOverflowY: body.style.overflowY,
          prevOverflowAnchor: body.style.overflowAnchor,
          prevOverscrollBehavior: body.style.overscrollBehavior,
          prevScrollBehavior: body.style.scrollBehavior,
        });
      }

      return targets;
    };

    const restoreFrozenScroll = () => {
      frozenScrollTargets.forEach(({ node, top, left }) => {
        node.scrollTop = top;
        node.scrollLeft = left;
      });
      if (
        Math.abs(window.scrollY - frozenWindowTop) > 1 ||
        Math.abs(window.scrollX - frozenWindowLeft) > 1
      ) {
        window.scrollTo(frozenWindowLeft, frozenWindowTop);
      }
    };

    const startScrollFreeze = (view: EditorView) => {
      cleanupScrollFreeze();
      frozenScrollTargets = collectScrollableTargets(view);
      frozenWindowTop = window.scrollY;
      frozenWindowLeft = window.scrollX;

      frozenScrollTargets.forEach((target) => {
        target.node.style.overflowAnchor = "none";
        target.node.style.overscrollBehavior = "none";
        target.node.style.scrollBehavior = "auto";
        target.node.style.overflowX = "hidden";
        target.node.style.overflowY = "hidden";
      });

      scrollFreezeHandler = () => {
        restoreFrozenScroll();
      };
      window.addEventListener("scroll", scrollFreezeHandler, { passive: true });
      frozenScrollTargets.forEach(({ node }) => {
        node.addEventListener("scroll", scrollFreezeHandler as EventListener, {
          passive: true,
        });
      });

      const tick = () => {
        restoreFrozenScroll();
        if (!scrollFreezeHandler) return;
        scrollFreezeRaf = window.requestAnimationFrame(tick);
      };
      scrollFreezeRaf = window.requestAnimationFrame(tick);

      // 兜底自动释放，防止极端情况下滚动冻结不释放
      scrollFreezeFallbackTimer = window.setTimeout(() => {
        cleanupScrollFreeze();
      }, 2600);
    };

    const scheduleImeScrollUnlock = (
      view: EditorView,
      delay = 520,
      snapshotBeforeUnlock?: ReturnType<typeof captureScrollSnapshot>,
    ) => {
      if (imeScrollLockReleaseTimer !== null) {
        window.clearTimeout(imeScrollLockReleaseTimer);
        imeScrollLockReleaseTimer = null;
      }
      imeScrollLockReleaseTimer = window.setTimeout(() => {
        const snapshot = snapshotBeforeUnlock ?? captureScrollSnapshot(view);
        setImeScrollLock(view, false);
        cleanupScrollFreeze();
        scheduleImeScrollRestore(snapshot);
        imeScrollLockReleaseTimer = null;
      }, delay);
    };

    const dispatchWithStableScroll = (
      view: EditorView,
      tr: Transaction,
    ) => {
      const snapshot = captureScrollSnapshot(view);
      view.dispatch(tr);
      restoreScrollSnapshot(snapshot);
      requestAnimationFrame(() => {
        restoreScrollSnapshot(snapshot);
      });
      window.setTimeout(() => {
        restoreScrollSnapshot(snapshot);
      }, 0);
    };

    const moveSelectionToTitleEnd = (view: EditorView) => {
      const firstNode = view.state.doc.firstChild;
      if (
        !firstNode ||
        firstNode.type.name !== "heading" ||
        firstNode.attrs?.level !== 1
      ) {
        return;
      }

      const titleEnd = Math.max(1, firstNode.nodeSize - 1);
      if (
        view.state.selection.empty &&
        view.state.selection.from === titleEnd &&
        view.state.selection.to === titleEnd
      ) {
        return;
      }
      const tr = view.state.tr;
      tr.setSelection(Selection.near(tr.doc.resolve(titleEnd), -1));
      tr.setMeta("addToHistory", false);
      dispatchWithStableScroll(view, tr);
    };

    const recoverMisplacedComposition = (
      view: EditorView,
      composedText: string,
      titleBefore: string,
    ) => {
      const safeComposedText = composedText.trim();
      if (!safeComposedText) return;

      const { state } = view;
      const { doc, schema } = state;
      const firstNode = doc.firstChild;
      if (
        !firstNode ||
        firstNode.type.name !== "heading" ||
        firstNode.attrs?.level !== 1 ||
        doc.childCount < 2
      ) {
        return;
      }

      const secondNode = doc.child(1);
      const secondText = secondNode.textContent.trim();
      if (!secondText || secondText !== safeComposedText) return;

      const keepLen = titleBefore.length;
      const curLen = firstNode.content.size;
      const currentTitleText = firstNode.textContent;
      const appendedText = currentTitleText.startsWith(titleBefore)
        ? currentTitleText.slice(titleBefore.length)
        : "";

      const tr = state.tr;

      if (curLen > keepLen && appendedText !== secondText) {
        tr.replaceWith(1 + keepLen, 1 + curLen, schema.text(secondText));
      } else if (curLen <= keepLen) {
        tr.insertText(secondText, 1 + curLen);
      }

      const mappedStart = tr.mapping.map(firstNode.nodeSize);
      const mappedEnd = tr.mapping.map(firstNode.nodeSize + secondNode.nodeSize);
      tr.delete(mappedStart, mappedEnd);

      if (tr.docChanged) {
        const titleNodeAfterFix = tr.doc.firstChild;
        if (titleNodeAfterFix) {
          const titleEnd = Math.max(1, titleNodeAfterFix.nodeSize - 1);
          tr.setSelection(Selection.near(tr.doc.resolve(titleEnd), -1));
          tr.setMeta("addToHistory", false);
        }
        dispatchWithStableScroll(view, tr);
      }
    };

    return [
      new Plugin({
        key: new PluginKey("titleHeadingPlugin"),

        appendTransaction: (transactions, _oldState, newState) => {
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!docChanged) return null;

          const { doc, schema } = newState;
          const firstNode = doc.firstChild;

          // ── Enforce: first node must be heading level 1 ──
          if (
            !firstNode ||
            firstNode.type.name !== "heading" ||
            firstNode.attrs.level !== 1
          ) {
            const tr = newState.tr;

            if (!firstNode) {
              tr.insert(0, schema.nodes.heading.create({ level: 1 }));
              return tr;
            }

            if (
              firstNode.type.name === "paragraph" &&
              firstNode.content.size === 0
            ) {
              tr.setNodeMarkup(0, schema.nodes.heading, { level: 1 });
              return tr;
            }

            if (
              firstNode.type.name === "heading" &&
              firstNode.attrs.level !== 1
            ) {
              tr.setNodeMarkup(0, schema.nodes.heading, { level: 1 });
              return tr;
            }

            if (firstNode.type.name !== "heading") {
              tr.insert(0, schema.nodes.heading.create({ level: 1 }));
              return tr;
            }
          }

          return null;
        },
        view: () => ({
          destroy: () => {
            cleanupImeConfirmGuard();
            if (imeScrollLockReleaseTimer !== null) {
              window.clearTimeout(imeScrollLockReleaseTimer);
              imeScrollLockReleaseTimer = null;
            }
            clearImeScrollRestoreTimers();
            cleanupScrollFreeze();
          },
        }),

        props: {
          handleDOMEvents: {
            compositionstart: (view) => {
              clearImeScrollRestoreTimers();
              composingInTitle = isSelectionInTitle(view);
              titleTextBeforeComposition = composingInTitle
                ? view.state.doc.firstChild?.textContent ?? ""
                : "";
              if (composingInTitle) {
                setImeScrollLock(view, true);
                startScrollFreeze(view);
              } else {
                setImeScrollLock(view, false);
                cleanupScrollFreeze();
              }
              return false;
            },
            compositionend: (view, event) => {
              const ce = event as CompositionEvent;
              const composedText = ce.data || "";
              const endedInTitle = composingInTitle || isSelectionInTitle(view);
              const titleBefore = titleTextBeforeComposition;
              const titleScrollSnapshot = endedInTitle
                ? captureScrollSnapshot(view)
                : undefined;
              composingInTitle = false;
              titleTextBeforeComposition = "";
              if (endedInTitle) {
                suppressImeConfirmKeyUntil = Date.now() + 32;
                setImeScrollLock(view, true);
                startScrollFreeze(view);
                armImeConfirmGuard();
                const unlockDelay = hasHandledFirstTitleImeConfirm ? 560 : 920;
                hasHandledFirstTitleImeConfirm = true;
                if (titleScrollSnapshot) {
                  scheduleImeScrollRestore(titleScrollSnapshot, [0, 24, 72]);
                }
                scheduleImeScrollUnlock(view, unlockDelay, titleScrollSnapshot);
              } else {
                scheduleImeScrollUnlock(view, 40);
              }

              if (endedInTitle && composedText.trim()) {
                queueMicrotask(() => {
                  recoverMisplacedComposition(view, composedText, titleBefore);
                  moveSelectionToTitleEnd(view);
                });
              } else if (endedInTitle) {
                queueMicrotask(() => {
                  moveSelectionToTitleEnd(view);
                });
              }

              // Let ProseMirror handle the event normally
              return false;
            },
            beforeinput: (view, event) => {
              const inputEvent = event as InputEvent;
              const inputType = inputEvent.inputType || "";
              if (
                inputType !== "insertParagraph" &&
                inputType !== "insertLineBreak"
              ) {
                return false;
              }

              if (suppressBeforeInputInsertParagraphUntil > Date.now()) {
                event.preventDefault();
                return true;
              }

              if (!isSelectionInTitle(view)) return false;
              event.preventDefault();

              if (inputType === "insertLineBreak") {
                return true;
              }

              const { state } = view;
              const { $from } = state.selection;
              const { tr } = state;
              tr.split($from.pos, 1, [{ type: state.schema.nodes.paragraph }]);
              dispatchWithStableScroll(view, tr);
              return true;
            },
          },

          handleKeyDown: (view, event) => {
            // Skip during active IME composition
            if (event.isComposing || event.keyCode === 229) return false;

            if (
              suppressImeConfirmKeyUntil > Date.now() &&
              isImeConfirmKey(event)
            ) {
              event.preventDefault();
              return true;
            }

            const { state } = view;
            const { selection, doc, schema } = state;
            const { $from } = selection;

            const isInTitle = $from.before(1) === 0;

            if (!isInTitle) {
              if (event.key === "ArrowUp") {
                const titleNode = doc.firstChild;
                const titleSize = titleNode ? titleNode.nodeSize : 0;

                if (
                  $from.before(1) === titleSize &&
                  view.endOfTextblock("up")
                ) {
                  return moveSelectionToBlockBoundary(view, 0, "end");
                }
              }
              return false;
            }

            if (
              event.key === "Backspace" &&
              $from.pos === 1 &&
              selection.empty
            ) {
              event.preventDefault();
              return true;
            }

            if (event.key === "Enter" && event.shiftKey) {
              suppressBeforeInputInsertParagraphUntil = Date.now() + 160;
              event.preventDefault();
              return true;
            }

            if (event.key === "Enter") {
              suppressBeforeInputInsertParagraphUntil = Date.now() + 160;
              event.preventDefault();
              const { tr } = state;
              tr.split($from.pos, 1, [{ type: schema.nodes.paragraph }]);
              dispatchWithStableScroll(view, tr);
              return true;
            }

            if (event.key === "ArrowDown") {
              if (view.endOfTextblock("down")) {
                if (doc.childCount > 1) {
                  return moveSelectionToBlockBoundary(view, 0, "after");
                }
              }
            }

            return false;
          },
        },
      }),
    ];
  },
});
