import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useExtension } from "@blocknote/react";
import { SuggestionMenu } from "@blocknote/core/extensions";
import { isWorkspaceSettingsOpen } from "@/lib/settings-navigation";
import { isSuggestionMenuAcceptKey } from "@/components/editor/utils/slashMenuPolicy";
import { isSlashMenuDivider, type SlashMenuItem } from "./blocknoteSlashItems";

const KEYBOARD_NAV_IGNORE_MOUSE_MS = 700;
const SCROLL_ANIM_MS = 180;
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function clampScrollTop(container: HTMLElement, top: number): number {
  const max = Math.max(0, container.scrollHeight - container.clientHeight);
  return Math.max(0, Math.min(top, max));
}

function scrollTopToCenterItem(
  container: HTMLElement,
  itemEl: HTMLElement,
  movingDown: boolean,
  movingUp: boolean,
): number | null {
  const itemCenter = itemEl.offsetTop + itemEl.offsetHeight / 2;
  const viewportCenter = container.scrollTop + container.clientHeight / 2;
  if (
    (!movingDown || itemCenter < viewportCenter) &&
    (!movingUp || itemCenter > viewportCenter)
  ) {
    return null;
  }
  return clampScrollTop(container, itemCenter - container.clientHeight / 2);
}

interface ScrollTween {
  from: number;
  to: number;
  startMs: number;
  durationMs: number;
}

export function useCustomSlashNavigation(
  items: SlashMenuItem[],
  externalIndex: number | undefined,
  onItemClick?: (item: SlashMenuItem) => void,
) {
  const [selectedIndex, setSelectedIndex] = useState(externalIndex ?? 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestionMenu = useExtension(SuggestionMenu);
  const ignoreMouseEnterUntilRef = useRef(0);
  const lastKeyboardNavAtRef = useRef(0);
  const previousSelectedIndexRef = useRef(selectedIndex);
  const scrollTweenRef = useRef<ScrollTween | null>(null);
  const scrollRafRef = useRef(0);
  const suppressHoverTimerRef = useRef<number | null>(null);
  const [suppressItemHover, setSuppressItemHover] = useState(false);

  const selectableIndexes = useMemo(
    () =>
      items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !isSlashMenuDivider(item) && !item.disabled)
        .map(({ index }) => index),
    [items],
  );

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item && !isSlashMenuDivider(item) && !item.disabled) {
        onItemClick?.(item);
      }
    },
    [items, onItemClick],
  );

  const readAnimatedScrollTop = useCallback((): number => {
    const container = containerRef.current;
    if (!container) return 0;
    const tween = scrollTweenRef.current;
    if (!tween) return container.scrollTop;
    const elapsed = performance.now() - tween.startMs;
    const t = Math.min(1, elapsed / tween.durationMs);
    return tween.from + (tween.to - tween.from) * easeOutCubic(t);
  }, []);

  const cancelScrollAnimation = useCallback(() => {
    if (scrollRafRef.current !== 0) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = 0;
    }
    scrollTweenRef.current = null;
  }, []);

  const startScrollTo = useCallback(
    (to: number) => {
      const container = containerRef.current;
      if (!container) return;
      const from = readAnimatedScrollTop();
      if (Math.abs(to - from) < 0.5) {
        container.scrollTop = to;
        cancelScrollAnimation();
        return;
      }
      scrollTweenRef.current = {
        from,
        to,
        startMs: performance.now(),
        durationMs: SCROLL_ANIM_MS,
      };
      const tick = () => {
        const el = containerRef.current;
        const active = scrollTweenRef.current;
        if (!el || !active) {
          scrollRafRef.current = 0;
          return;
        }
        const elapsed = performance.now() - active.startMs;
        const t = Math.min(1, elapsed / active.durationMs);
        el.scrollTop =
          active.from + (active.to - active.from) * easeOutCubic(t);
        if (t >= 1) {
          el.scrollTop = active.to;
          scrollTweenRef.current = null;
          scrollRafRef.current = 0;
          return;
        }
        scrollRafRef.current = requestAnimationFrame(tick);
      };
      if (scrollRafRef.current !== 0) {
        cancelAnimationFrame(scrollRafRef.current);
      }
      scrollRafRef.current = requestAnimationFrame(tick);
    },
    [cancelScrollAnimation, readAnimatedScrollTop],
  );

  const beginKeyboardNav = useCallback(() => {
    const now = Date.now();
    lastKeyboardNavAtRef.current = now;
    ignoreMouseEnterUntilRef.current = now + KEYBOARD_NAV_IGNORE_MOUSE_MS;
    setSuppressItemHover(true);
    if (suppressHoverTimerRef.current !== null) {
      window.clearTimeout(suppressHoverTimerRef.current);
    }
    suppressHoverTimerRef.current = window.setTimeout(() => {
      suppressHoverTimerRef.current = null;
      setSuppressItemHover(false);
    }, KEYBOARD_NAV_IGNORE_MOUSE_MS);
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      const timer = setTimeout(() => suggestionMenu?.closeMenu(), 0);
      return () => clearTimeout(timer);
    }
    if (selectableIndexes.length === 0) {
      setSelectedIndex(0);
    } else if (!selectableIndexes.includes(selectedIndex)) {
      setSelectedIndex(selectableIndexes[0]);
    }
  }, [items, selectableIndexes, selectedIndex, suggestionMenu]);

  useEffect(() => {
    return () => {
      if (suppressHoverTimerRef.current !== null) {
        window.clearTimeout(suppressHoverTimerRef.current);
      }
      cancelScrollAnimation();
    };
  }, [cancelScrollAnimation]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const selectedEl = container.querySelector(
      `[data-index="${selectedIndex}"]`,
    ) as HTMLElement | null;
    if (!selectedEl) return;

    const previousIndex = previousSelectedIndexRef.current;
    previousSelectedIndexRef.current = selectedIndex;
    const fromKeyboard =
      Date.now() - lastKeyboardNavAtRef.current < KEYBOARD_NAV_IGNORE_MOUSE_MS;
    if (!fromKeyboard) return;

    const wrappedToStart =
      previousIndex === selectableIndexes[selectableIndexes.length - 1] &&
      selectedIndex === selectableIndexes[0];
    const wrappedToEnd =
      previousIndex === selectableIndexes[0] &&
      selectedIndex === selectableIndexes[selectableIndexes.length - 1];
    const target = wrappedToStart
      ? 0
      : wrappedToEnd
        ? container.scrollHeight - container.clientHeight
        : scrollTopToCenterItem(
            container,
            selectedEl,
            selectedIndex > previousIndex,
            selectedIndex < previousIndex,
          );
    if (target === null) return;

    startScrollTo(target);
  }, [selectedIndex, selectableIndexes, startScrollTo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isWorkspaceSettingsOpen()) return;
      if (!containerRef.current || !containerRef.current.isConnected) return;
      const target = e.target as HTMLElement | null;
      const inEditorScope = !!target?.closest(
        '.bn-editor, [data-content-type="blockNote"]',
      );
      if (!inEditorScope) return;
      if (e.isComposing) return;
      if (!selectableIndexes.length) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        beginKeyboardNav();
        const pos = Math.max(selectableIndexes.indexOf(selectedIndex), 0);
        if (pos === 0) {
          setSelectedIndex(selectableIndexes[selectableIndexes.length - 1]);
        } else {
          setSelectedIndex(selectableIndexes[pos - 1]);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        beginKeyboardNav();
        const pos = Math.max(selectableIndexes.indexOf(selectedIndex), 0);
        if (pos === selectableIndexes.length - 1) {
          setSelectedIndex(selectableIndexes[0]);
        } else {
          setSelectedIndex(selectableIndexes[pos + 1]);
        }
      } else if (isSuggestionMenuAcceptKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        const validIndex = selectableIndexes.includes(selectedIndex)
          ? selectedIndex
          : selectableIndexes[0];
        selectItem(validIndex);
        suggestionMenu?.closeMenu();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [
    selectedIndex,
    selectItem,
    selectableIndexes,
    beginKeyboardNav,
    suggestionMenu,
  ]);

  return {
    selectedIndex,
    setSelectedIndex,
    containerRef,
    suppressItemHover,
    ignoreMouseEnterUntilRef,
    selectItem,
  };
}
