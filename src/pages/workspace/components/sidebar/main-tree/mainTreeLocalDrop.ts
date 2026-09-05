import type { DragEvent as ReactDragEvent } from "react";
import { isExternalFileDrag } from "@/lib/local-folder-target";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import {
  dropLineTopPx,
  findLastRowAboveY,
  findRowAtY,
  resolveLocalFolderDropParentId,
  type TreeRowDropInfo,
} from "./mainTreeDragGeometry";

let capturedParentId: string | undefined | null = null;
let highlightedRow: HTMLElement | null = null;

function isActiveLocalFolderNotebook(): boolean {
  const { activeNotebookId, notebooks } = useNotebooks.getState();
  if (!activeNotebookId) return false;
  return notebooks[activeNotebookId]?.source === "local-folder";
}

function readTreeRows(tree: Element): TreeRowDropInfo[] {
  const pages = usePages.getState().pages;
  const nodes = tree.querySelectorAll<HTMLElement>(
    "[data-rct-item-container='true']",
  );
  const rows: TreeRowDropInfo[] = [];
  nodes.forEach((node) => {
    const id =
      node
        .querySelector("[data-rct-item-id]")
        ?.getAttribute("data-rct-item-id") ?? null;
    if (!id || id === "root") return;
    const page = pages[id];
    const rect = node.getBoundingClientRect();
    rows.push({
      id,
      isFolder: !!page?.isFolder,
      parentId: page?.parentId,
      top: rect.top,
      bottom: rect.bottom,
    });
  });
  return rows;
}

function findRowByItemId(pageId: string): HTMLElement | null {
  const markers = document.querySelectorAll("[data-rct-item-id]");
  for (const marker of markers) {
    if (marker.getAttribute("data-rct-item-id") !== pageId) continue;
    const row = marker.closest(".main-tree-row");
    return row instanceof HTMLElement ? row : null;
  }
  return null;
}

export function applyMainTreeNestHighlight(pageId: string | undefined): void {
  highlightedRow?.classList.remove("main-tree-row--drop-target-local");
  highlightedRow = null;
  if (!pageId) return;
  const row = findRowByItemId(pageId);
  if (!row) return;
  row.classList.add("main-tree-row--drop-target-local");
  highlightedRow = row;
}

export function captureLocalFolderDropParent(
  event: ReactDragEvent<HTMLElement>,
  tree: Element,
): string | undefined | null {
  if (!isActiveLocalFolderNotebook()) return null;
  if (isExternalFileDrag(event.dataTransfer)) return null;
  const rows = readTreeRows(tree);
  const hoveredId =
    event.target instanceof Element
      ? event.target
          .closest("[data-rct-item-id]")
          ?.getAttribute("data-rct-item-id")
      : null;
  const hoveredFromId = hoveredId
    ? (rows.find((row) => row.id === hoveredId) ?? null)
    : null;
  const hovered = hoveredFromId ?? findRowAtY(rows, event.clientY);
  const fallback = findLastRowAboveY(rows, event.clientY);
  const parentId = resolveLocalFolderDropParentId(hovered, fallback);
  capturedParentId = parentId;
  applyMainTreeNestHighlight(parentId);
  return parentId;
}

export function peekLocalFolderDropParent(): string | undefined | null {
  return capturedParentId;
}

export function takeLocalFolderDropParent(): string | undefined | null {
  const value = capturedParentId;
  capturedParentId = null;
  return value;
}

export function clearLocalFolderDropParent(): void {
  capturedParentId = null;
  applyMainTreeNestHighlight(undefined);
}

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
