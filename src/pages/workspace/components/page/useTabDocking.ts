import { useEffect, useState, type RefObject } from "react";
import { getGooseDesktop } from "@/lib/electron/runtime";
import {
  insertIndexFromTabRects,
  insertLineLeft,
  type TabRailRect,
} from "@/lib/electron/tabTearOff";
import { useTabs, type TabItem } from "@/stores/useTabs";

function readTabRects(scroller: HTMLElement): TabRailRect[] {
  return [...scroller.querySelectorAll<HTMLElement>(".tab-rail-item")].map(
    (el) => {
      const box = el.getBoundingClientRect();
      return {
        left: box.left,
        width: box.width,
        pinned: el.hasAttribute("data-tab-pinned"),
      };
    },
  );
}

function indicatorLeftForContentX(
  scroller: HTMLElement,
  contentX: number,
  incomingPinned: boolean,
): number | null {
  const rects = readTabRects(scroller);
  const index = insertIndexFromTabRects(rects, contentX, incomingPinned);
  const viewportX = insertLineLeft(rects, index);
  if (viewportX == null) return null;
  const rail = scroller.getBoundingClientRect();
  return viewportX - rail.left + scroller.scrollLeft;
}

export function useTabDocking(opts: {
  enabled: boolean;
  scrollerRef: RefObject<HTMLDivElement | null>;
}): { insertLeft: number | null } {
  const [insertLeft, setInsertLeft] = useState<number | null>(null);
  const { enabled, scrollerRef } = opts;

  useEffect(() => {
    if (!enabled) return;
    const desktop = getGooseDesktop();
    if (!desktop?.onAcceptTab) return;

    const unsubAccept = desktop.onAcceptTab((payload) => {
      const scroller = scrollerRef.current;
      const rects = scroller ? readTabRects(scroller) : [];
      const index = insertIndexFromTabRects(
        rects,
        payload.contentX,
        Boolean(payload.tab.pinned),
      );
      const incoming: TabItem = {
        id: payload.tab.id,
        pageId: payload.tab.pageId,
        type: payload.tab.type as TabItem["type"],
        pinned: payload.tab.pinned,
        workspaceId: payload.tab.workspaceId,
      };
      useTabs.getState().adoptTab(incoming, index);
      setInsertLeft(null);
    });
    const unsubPreview = desktop.onTabDockPreview?.((payload) => {
      const scroller = scrollerRef.current;
      if (payload.contentX == null || !scroller) {
        setInsertLeft(null);
        return;
      }
      setInsertLeft(indicatorLeftForContentX(scroller, payload.contentX, false));
    });
    return () => {
      unsubAccept();
      unsubPreview?.();
      setInsertLeft(null);
    };
  }, [enabled, scrollerRef]);

  return { insertLeft };
}
