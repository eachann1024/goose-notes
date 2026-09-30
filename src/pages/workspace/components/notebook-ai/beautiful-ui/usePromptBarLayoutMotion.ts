import { useLayoutEffect, type RefObject } from "react";

const DURATION = 180;
const EASING = "cubic-bezier(0.23, 1, 0.32, 1)";

/** One layout transition owns the surface and its controls; the editor never scales. */
export function usePromptBarLayoutMotion(ref: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const bar = ref.current;
    const shell = bar?.querySelector<HTMLElement>(".notebook-ai-composer-shell");
    if (!bar || !shell) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let height = shell.getBoundingClientRect().height;
    let positions = new Map<HTMLElement, DOMRect>();
    let animations: Animation[] = [];

    const children = () => Array.from(shell.children).filter(
      (node): node is HTMLElement => node instanceof HTMLElement && node.tagName !== "INPUT" && node.getBoundingClientRect().height > 0,
    );
    const remember = () => {
      const top = bar.getBoundingClientRect().top;
      positions = new Map(children().map((node) => {
        const rect = node.getBoundingClientRect();
        return [node, new DOMRect(rect.x, rect.y - top, rect.width, rect.height)];
      }));
    };
    remember();

    const update = () => {
      const nextHeight = shell.getBoundingClientRect().height;
      if (Math.abs(nextHeight - height) < 0.5) {
        if (animations.every((animation) => animation.playState !== "running")) remember();
        return;
      }
      // On interruption, start from the currently painted positions, not the old target.
      const running = animations.some((animation) => animation.playState === "running");
      const fromHeight = running ? bar.getBoundingClientRect().height : height;
      if (running) remember();
      animations.forEach((animation) => animation.cancel());
      animations = [];
      const previous = positions;
      height = nextHeight;
      remember();
      if (reducedMotion.matches) return;

      const timing = { duration: DURATION, easing: EASING };
      animations.push(bar.animate([
        { height: `${fromHeight}px` },
        { height: `${nextHeight}px` },
      ], timing));
      for (const [node, rect] of positions) {
        const before = previous.get(node);
        if (!before) continue;
        const dx = before.x - rect.x;
        const dy = before.y - rect.y;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
        animations.push(node.animate([
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0px, 0px)" },
        ], timing));
      }
    };
    const observer = new ResizeObserver(update);
    observer.observe(shell);
    // DOM 输入与 React 换排完成后、首次绘制前就冻结旧高度，不能等下一帧量高。
    const mutations = new MutationObserver((records) => {
      const editor = shell.querySelector("[data-ai-composer-editor]");
      if (records.some((record) =>
        record.target === shell && record.type === "attributes" ||
        editor?.contains(record.target),
      )) queueMicrotask(update);
    });
    mutations.observe(shell, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ["class"],
    });
    const stopMotion = () => {
      if (reducedMotion.matches) animations.forEach((animation) => animation.cancel());
    };
    reducedMotion.addEventListener("change", stopMotion);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      reducedMotion.removeEventListener("change", stopMotion);
      animations.forEach((animation) => animation.cancel());
    };
  }, [ref]);
}
