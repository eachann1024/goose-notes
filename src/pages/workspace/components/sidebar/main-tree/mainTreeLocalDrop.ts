import { dropLineTopPx } from "./mainTreeDragGeometry";

export function snapDragBetweenLine(
  lineEl: HTMLElement,
  linearIndex: number,
): void {
  const wrapper = lineEl.parentElement;
  const tree = lineEl.closest("[data-rct-tree]");
  if (!wrapper || !tree) return;
  const treeTop = tree.getBoundingClientRect().top;
  const nodes = tree.querySelectorAll<HTMLElement>(
    "[data-rct-item-container='true']",
  );
  const offsets: number[] = [];
  let lastHeight = 0;
  nodes.forEach((node) => {
    const rect = node.getBoundingClientRect();
    offsets.push(rect.top - treeTop);
    lastHeight = rect.height;
  });
  wrapper.style.top = `${dropLineTopPx(linearIndex, offsets, lastHeight)}px`;
}
