import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, NodeSelection } from "@tiptap/pm/state";
import { Slice } from "@tiptap/pm/model";
import { dropPoint } from "@tiptap/pm/transform";
import * as pmView from "@tiptap/pm/view";

import {
  DRAG_HANDLE_CONSTANTS,
  getAdjustedCoords,
  isFirstChildOfEditor,
  absoluteRect,
  findBlockNodePos,
  nodePosAtDOM,
  calcNodePos,
  getNodeOffsetInfo,
  isSpecialBlockType,
} from "./dragHandle";

// --- Helper Functions ---

function getPmView() {
  try {
    return pmView;
  } catch {
    return null;
  }
}

function serializeForClipboard(view: any, slice: Slice) {
  if (view && typeof view.serializeForClipboard === "function") {
    return view.serializeForClipboard(slice);
  }
  const proseMirrorView = getPmView();
  if (
    proseMirrorView &&
    typeof (proseMirrorView as any)?.__serializeForClipboard === "function"
  ) {
    return (proseMirrorView as any).__serializeForClipboard(view, slice);
  }
  throw new Error("No supported clipboard serialization method found.");
}

interface DragHandleOptions {
  dragHandleWidth: number;
  scrollTreshold: number;
  dragHandleSelector?: string;
  excludedTags: string[];
  customNodes: string[];
}

function nodeDOMAtCoords(
  coords: { x: number; y: number },
  options: DragHandleOptions,
) {
  const selectors = [
    "li",
    "p:not(:first-child)",
    "pre",
    "blockquote",
    "h1:not(:first-child)",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "table",
    ".tableWrapper",
    ...options.customNodes.map((node) => `[data-type=${node}]`),
  ].join(", ");

  return document.elementsFromPoint(coords.x, coords.y).find((elem) => {
    if (elem.closest(".table-add-control")) return false;
    if (isFirstChildOfEditor(elem)) return false;
    return (
      elem.parentElement?.matches?.(".ProseMirror") || elem.matches(selectors)
    );
  });
}

// --- Main Plugin ---

function DragHandlePlugin(options: DragHandleOptions & { pluginKey: string }) {
  let dragHandleElement: HTMLElement | null = null;
  let currentHoveredNode: Element | null = null;
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;
  let isDragging = false;
  let justDropped = false;
  let keepVisibleUntil = 0;

  function hideDragHandle() {
    if (Date.now() < keepVisibleUntil) return;
    if (dragHandleElement) {
      dragHandleElement.classList.add("hide");
      dragHandleElement.classList.remove("has-folding-arrow");
    }
    currentHoveredNode = null;
  }

  function showDragHandle() {
    if (dragHandleElement) {
      dragHandleElement.classList.remove("hide");
    }
  }

  function updateHandlePosition(node: Element) {
    if (!dragHandleElement) return;

    if (isFirstChildOfEditor(node)) {
      hideDragHandle();
      return;
    }

    const compStyle = window.getComputedStyle(node);
    const paddingTop = parseFloat(compStyle.paddingTop);
    const rect = absoluteRect(node);

    // 处理特殊块类型
    const { isTableWrapper, isTable, isCodeBlock, targetNode } =
      isSpecialBlockType(node);

    // 表格和代码块特殊处理
    if (isTableWrapper || isTable) {
      const tableRect = absoluteRect(targetNode);
      rect.top = tableRect.top;
    } else if (!isCodeBlock) {
      // 普通块：计算手柄在内容中的垂直位置
      rect.top += paddingTop;
      const lineHeightRaw = compStyle.lineHeight;
      const fontSize = parseFloat(compStyle.fontSize);
      let lineHeight = parseFloat(lineHeightRaw);

      if (isNaN(lineHeight)) {
        lineHeight = fontSize * 1.2;
      } else if (lineHeight < 5) {
        lineHeight = lineHeight * fontSize;
      }

      const handleHeight =
        dragHandleElement && dragHandleElement.offsetHeight > 0
          ? dragHandleElement.offsetHeight
          : 24;

      rect.top += (lineHeight - handleHeight) / 2;
    }

    rect.width = options.dragHandleWidth;

    // 基于节点实际左边位置计算把手 X 坐标
    let fixedLeft = rect.left - rect.width - DRAG_HANDLE_CONSTANTS.editorMarginRight;

    // 配置驱动的位置偏移
    const { offset } = getNodeOffsetInfo(node);
    fixedLeft += offset;

    dragHandleElement.style.left = `${fixedLeft}px`;
    dragHandleElement.style.top = `${rect.top}px`;

    currentHoveredNode = node;
    showDragHandle();
  }

  function updateHandleBySelection(view: any) {
    // drop 后跳过基于 selection 的更新，等待 mousemove 重新设置
    if (justDropped) return;

    if (!view.editable || !dragHandleElement) {
      hideDragHandle();
      return;
    }

    const { selection } = view.state;
    if (!selection) return;

    if (selection instanceof NodeSelection) {
      const domNode = view.nodeDOM(selection.from);
      if (domNode instanceof Element) {
        updateHandlePosition(domNode);
        return;
      }
    }

    const resolved = selection.$from;
    const targetPos = findBlockNodePos(resolved);
    const domNode = view.nodeDOM(targetPos);

    if (!(domNode instanceof Element)) {
      hideDragHandle();
      return;
    }

    if (isFirstChildOfEditor(domNode)) {
      hideDragHandle();
      return;
    }

    const excludedTagList = options.excludedTags
      .concat(["ol", "ul"])
      .join(", ");
    if (
      !domNode.matches(excludedTagList) &&
      !domNode.closest(".not-draggable")
    ) {
      updateHandlePosition(domNode);
      return;
    }

    hideDragHandle();
  }

  function hideHandleOnEditorOut(event: MouseEvent) {
    if (isDragging) return;
    if (Date.now() < keepVisibleUntil) return;

    // 扩大安全区域判定
    if (dragHandleElement) {
      const handleRect = dragHandleElement.getBoundingClientRect();
      if (
        event.clientX <= handleRect.right + DRAG_HANDLE_CONSTANTS.safeMargin &&
        event.clientX >= handleRect.left - DRAG_HANDLE_CONSTANTS.safeMargin &&
        event.clientY <= handleRect.bottom + DRAG_HANDLE_CONSTANTS.safeMargin &&
        event.clientY >= handleRect.top - DRAG_HANDLE_CONSTANTS.safeMargin
      ) {
        return;
      }
    }

    if (event.target instanceof Element) {
      const relatedTarget = event.relatedTarget as Element | null;
      const isInsideEditor =
        relatedTarget?.closest(".tiptap") ||
        relatedTarget?.closest(".drag-handle") ||
        relatedTarget?.classList.contains("drag-handle");
      if (isInsideEditor) return;
    }

    if (hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      hideDragHandle();
    }, 100);
  }

  function handleDragStart(event: DragEvent, view: any) {
    view.focus();
    if (!event.dataTransfer) return;

    let node = currentHoveredNode;
    if (!node) {
      const coords = getAdjustedCoords(event, options.dragHandleWidth);
      node = nodeDOMAtCoords(coords, options) as Element | null;
    }

    // Fallback: 尝试通过 posAtCoords 查找
    if (!node || !(node instanceof Element)) {
      const coords = getAdjustedCoords(event, options.dragHandleWidth);
      const posCoords = view.posAtCoords({
        left: coords.x,
        top: coords.y,
      });

      if (posCoords) {
        const $pos = view.state.doc.resolve(posCoords.pos);
        const blockPos = findBlockNodePos($pos);
        const domNode = view.nodeDOM(blockPos);
        if (domNode instanceof Element) {
          node = domNode;
        }
      }
    }

    if (!(node instanceof Element)) return;

    const pos = nodePosAtDOM(node, view, options.dragHandleWidth);
    if (pos == null) return;

    const targetPos = calcNodePos(pos, view);
    const selection = NodeSelection.create(view.state.doc, targetPos);
    view.dispatch(view.state.tr.setSelection(selection));

    const slice = selection.content();
    const { dom, text } = serializeForClipboard(view, slice);

    event.dataTransfer.clearData();
    event.dataTransfer.setData("text/html", dom.innerHTML);
    event.dataTransfer.setData("text/plain", text);
    event.dataTransfer.effectAllowed = "copyMove";

    view.dragging = {
      slice,
      move: true,
      from: selection.from,
      to: selection.to,
    };
  }

  function handleDrop(view: any, event: DragEvent) {
    const dragging = view.dragging;
    if (!dragging || !dragging.slice) return false;

    const dropPos = view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    });
    if (!dropPos) return false;

    const insertPos = dropPoint(view.state.doc, dropPos.pos, dragging.slice);
    if (insertPos == null) return false;

    if (dragging.move) {
      const from = dragging.from ?? view.state.selection.from;
      const to = dragging.to ?? view.state.selection.to;

      // 防止在被拖拽的节点内部 drop
      if (insertPos >= from && insertPos <= to) {
        return false;
      }

      const tr = view.state.tr;
      tr.delete(from, to);
      const mappedPos = tr.mapping.map(insertPos);
      tr.insert(mappedPos, dragging.slice.content);
      view.dispatch(tr.scrollIntoView());

      currentHoveredNode = null;
      justDropped = true;

      event.preventDefault();
      return true;
    }

    return false;
  }

  return new Plugin({
    key: new PluginKey(options.pluginKey),
    view: (view) => {
      const handleBySelector = options.dragHandleSelector
        ? document.querySelector(options.dragHandleSelector)
        : null;
      dragHandleElement =
        (handleBySelector as HTMLElement) ?? document.createElement("div");
      dragHandleElement.draggable = true;
      dragHandleElement.dataset.dragHandle = "";
      dragHandleElement.dataset.onboarding = "drag-handle";
      dragHandleElement.classList.add("drag-handle");

      function onDragHandleDragStart(e: DragEvent) {
        isDragging = true;
        handleDragStart(e, view);
      }
      dragHandleElement.addEventListener("dragstart", onDragHandleDragStart);

      function onDragHandleDragEnd() {
        isDragging = false;
        hideDragHandle();
      }
      dragHandleElement.addEventListener("dragend", onDragHandleDragEnd);

      function onDragHandleDrag() {
        hideDragHandle();
      }
      dragHandleElement.addEventListener("drag", onDragHandleDrag);

      function onDocumentDrop(e: DragEvent) {
        hideDragHandle();
        handleDrop(view, e);
      }
      document.addEventListener("drop", onDocumentDrop);

      hideDragHandle();
      if (!handleBySelector) {
        view?.dom?.parentElement?.appendChild(dragHandleElement);
      }

      const handleMouseMove = (event: MouseEvent) => {
        justDropped = false;

        if (isDragging) return;

        if (!view.editable) {
          hideDragHandle();
          return;
        }

        if ((event.target as HTMLElement).closest(".table-add-control")) {
          return;
        }

        const coords = getAdjustedCoords(event, options.dragHandleWidth);
        let node = nodeDOMAtCoords(coords, options);

        // Fallback: 尝试通过 posAtCoords 查找
        if (!node || !(node instanceof Element)) {
          const posCoords = view.posAtCoords({
            left: coords.x,
            top: coords.y,
          });

          if (posCoords) {
            const $pos = view.state.doc.resolve(posCoords.pos);
            const blockPos = findBlockNodePos($pos);
            const domNode = view.nodeDOM(blockPos);
            if (domNode instanceof Element) {
              node = domNode;
            }
          }
        }

        if (!node || !(node instanceof Element)) {
          hideDragHandle();
          return;
        }

        const excludedTagList = options.excludedTags
          .concat(["ol", "ul"])
          .join(", ");

        if (node.matches(excludedTagList) || node.closest(".not-draggable")) {
          hideDragHandle();
          return;
        }

        updateHandlePosition(node);
      };

      view?.dom?.parentElement?.addEventListener(
        "mouseout",
        hideHandleOnEditorOut as any,
      );
      view?.dom?.parentElement?.addEventListener(
        "mousemove",
        handleMouseMove as any,
      );

      return {
        update: () => {
          updateHandleBySelection(view);
        },
        destroy: () => {
          if (hideTimeout) clearTimeout(hideTimeout);
          if (!handleBySelector) {
            dragHandleElement?.remove();
          }
          dragHandleElement?.removeEventListener("drag", onDragHandleDrag);
          dragHandleElement?.removeEventListener(
            "dragstart",
            onDragHandleDragStart,
          );
          document.removeEventListener("drop", onDocumentDrop);
          view?.dom?.parentElement?.removeEventListener(
            "mouseout",
            hideHandleOnEditorOut as any,
          );
          view?.dom?.parentElement?.removeEventListener(
            "mousemove",
            handleMouseMove as any,
          );
          dragHandleElement?.removeEventListener("dragend", onDragHandleDragEnd);
          dragHandleElement = null;
        },
      };
    },
    props: {
      handleDOMEvents: {
        mousemove: () => false,
        mousedown: (_view, event) => {
          justDropped = false;
          if (
            event.target instanceof Element &&
            event.target.closest(".folding-arrow")
          ) {
            return false;
          }
          return false;
        },
        keydown: () => {
          hideDragHandle();
          return false;
        },
        mousewheel: () => {
          hideDragHandle();
          return false;
        },
        dragstart: (view) => {
          isDragging = true;
          view.dom.classList.add("dragging");
          return false;
        },
        dragover: (_view, event) => {
          event.preventDefault();
          return false;
        },
        drop: (view, event) => {
          view.dom.classList.remove("dragging");
          hideDragHandle();
          return handleDrop(view, event);
        },
        dragend: (view) => {
          isDragging = false;
          view.dom.classList.remove("dragging");
          hideDragHandle();
          return false;
        },
      },
    },
  });
}

export const CustomGlobalDragHandle = Extension.create({
  name: "customGlobalDragHandle",
  addOptions() {
    return {
      dragHandleWidth: 20,
      scrollTreshold: 100,
      excludedTags: [] as string[],
      customNodes: [] as string[],
    };
  },
  addProseMirrorPlugins() {
    return [
      DragHandlePlugin({
        pluginKey: "customGlobalDragHandle",
        dragHandleWidth: this.options.dragHandleWidth,
        scrollTreshold: this.options.scrollTreshold,
        dragHandleSelector: this.options.dragHandleSelector,
        excludedTags: this.options.excludedTags,
        customNodes: this.options.customNodes,
      }),
    ];
  },
});
