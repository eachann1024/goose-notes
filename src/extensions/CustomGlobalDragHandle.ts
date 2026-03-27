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
  handleElement?: HTMLElement | null,
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

  // 临时隐藏把手，防止干扰节点查找
  const originalDisplay = handleElement?.style.display;
  if (handleElement) {
    handleElement.style.display = "none";
  }

  const result = document.elementsFromPoint(coords.x, coords.y).find((elem) => {
    if (elem.closest(".table-add-control")) return false;
    if (isFirstChildOfEditor(elem)) return false;
    // blockquote/table 内部的元素只允许容器自身显示把手
    if (elem.closest("blockquote") && !elem.matches("blockquote")) return false;
    if (elem.closest(".tableWrapper") && !elem.matches(".tableWrapper")) return false;
    return (
      elem.parentElement?.matches?.(".ProseMirror") || elem.matches(selectors)
    );
  });

  // 恢复把手显示
  if (handleElement) {
    handleElement.style.display = originalDisplay || "";
  }

  return result;
}

// --- Main Plugin ---

// --- Auto-scroll helpers ---

function findScrollContainer(el: Element): Element {
  let parent = el.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflow = style.overflowY;
    if ((overflow === "auto" || overflow === "scroll") && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return document.documentElement;
}

function DragHandlePlugin(options: DragHandleOptions & { pluginKey: string }) {
  let dragHandleElement: HTMLElement | null = null;
  let currentHoveredNode: Element | null = null;
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;
  let isDragging = false;
  let justDropped = false;
  let keepVisibleUntil = 0;
  let isHoveringHandle = false;
  let autoScrollRafId: number | null = null;
  let autoScrollDir: -1 | 0 | 1 = 0; // -1=up, 0=none, 1=down

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

  function isVisibleHandleAnchor(node: Element) {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    return node.getClientRects().length > 0;
  }

  function resolveVisibleHandleNode(node: Element) {
    const editorRoot = node.closest(".ProseMirror");
    if (!editorRoot) return node;

    let target = node;
    while (target.parentElement && target.parentElement !== editorRoot) {
      target = target.parentElement;
    }

    if (isVisibleHandleAnchor(target)) {
      return target;
    }

    let fallback = target.previousElementSibling;
    while (fallback) {
      if (isVisibleHandleAnchor(fallback)) {
        return fallback;
      }
      fallback = fallback.previousElementSibling;
    }

    return target;
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

    // 分割线特殊处理：相对于整个容器（包括 padding）垂直居中
    const isHorizontalRule = node.matches(".horizontal-rule-wrapper");
    
    // 表格和代码块特殊处理
    if (isTableWrapper || isTable) {
      const tableRect = absoluteRect(targetNode);
      rect.top = tableRect.top;
    } else if (isHorizontalRule) {
      // 分割线：把手相对于整个容器垂直居中
      const handleHeight =
        dragHandleElement && dragHandleElement.offsetHeight > 0
          ? dragHandleElement.offsetHeight
          : 24;
      const containerHeight = node.getBoundingClientRect().height;
      rect.top += (containerHeight - handleHeight) / 2;
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

    // 把手始终限制在编辑区内，避免全宽模式下贴到侧边栏边缘
    const editorRoot = node.closest(".ProseMirror");
    if (editorRoot) {
      const editorRect = absoluteRect(editorRoot);
      const minLeft = editorRect.left - options.dragHandleWidth - 12;
      fixedLeft = Math.max(fixedLeft, minLeft);
    }

    dragHandleElement.style.left = `${fixedLeft}px`;
    dragHandleElement.style.top = `${rect.top}px`;

    currentHoveredNode = node;
    showDragHandle();
  }

  function updateHandleBySelection(view: any) {
    // drop 后跳过基于 selection 的更新，等待 mousemove 重新设置
    if (justDropped) return;

    // 鼠标悬停在把手上时，不根据选区更新位置（防止拖拽前把手跳动）
    if (isHoveringHandle) return;

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
    let domNode = view.nodeDOM(targetPos);

    if (!(domNode instanceof Element)) {
      hideDragHandle();
      return;
    }

    domNode = resolveVisibleHandleNode(domNode);

    // blockquote/table 内部元素统一定位到容器本身
    const blockquoteParent = domNode.closest("blockquote");
    if (blockquoteParent && !domNode.matches("blockquote")) {
      domNode = blockquoteParent;
    }
    const tableWrapper = domNode.closest(".tableWrapper");
    if (tableWrapper && !domNode.matches(".tableWrapper")) {
      domNode = tableWrapper;
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

  function handleDragStart(event: DragEvent, view: any): boolean {
    view.focus();
    if (!event.dataTransfer) return false;

    let node = currentHoveredNode;
    if (node && !view.dom.contains(node)) {
      node = null;
    }
    
    if (!node) {
      const coords = getAdjustedCoords(event, options.dragHandleWidth);
      node = nodeDOMAtCoords(coords, options, dragHandleElement) as Element | null;
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

    if (!(node instanceof Element)) return false;

    const pos = nodePosAtDOM(node, view, options.dragHandleWidth);
    let targetPos: number | null =
      pos == null ? null : calcNodePos(pos, view);

    // 坐标命中失败时，回退到当前选区所在块，避免拖拽被中断
    if (targetPos == null) {
      targetPos = findBlockNodePos(view.state.selection.$from);
    }

    if (targetPos == null) return false;

    let selection: NodeSelection;
    try {
      selection = NodeSelection.create(view.state.doc, targetPos);
    } catch {
      return false;
    }
    view.dispatch(view.state.tr.setSelection(selection));

    const slice = selection.content();
    const { dom, text } = serializeForClipboard(view, slice);

    event.dataTransfer.clearData();
    event.dataTransfer.setData("text/html", dom.innerHTML);
    event.dataTransfer.setData("text/plain", text);
    event.dataTransfer.setData("application/x-goose-note-drag", "move");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.dropEffect = "move";

    view.dragging = {
      slice,
      move: true,
      from: selection.from,
      to: selection.to,
    };

    return true;
  }

  function handleDrop(view: any, event: DragEvent) {
    const titleNode = view.state.doc.firstChild;
    const dropPos = view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    });

    const firstDomNode = view.dom?.firstElementChild as HTMLElement | null;
    const isInTitleDomZone = (() => {
      if (!firstDomNode) return false;
      const rect = firstDomNode.getBoundingClientRect();
      const xHit = event.clientX >= rect.left - 12 && event.clientX <= rect.right + 12;
      const yHit = event.clientY <= rect.bottom;
      return xHit && yHit;
    })();

    if (
      (titleNode && dropPos && dropPos.pos < titleNode.nodeSize) ||
      isInTitleDomZone
    ) {
      event.preventDefault();
      view.dragging = null;
      isDragging = false;
      return true;
    }

    const dragging = view.dragging;
    if (!dragging || !dragging.slice) return false;

    if (!dropPos) return false;

    const insertPos = dropPoint(view.state.doc, dropPos.pos, dragging.slice);
    if (insertPos == null) return false;

    // Prevent dropping above or into the title heading (first node).
    // Return true (= "handled") so ProseMirror's default drop doesn't run.
    if (titleNode && insertPos < titleNode.nodeSize) {
      event.preventDefault();
      view.dragging = null;
      isDragging = false;
      return true;
    }

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

      view.dragging = null;
      isDragging = false;
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
      dragHandleElement.classList.add("drag-handle");

      function onDragHandleClick(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();

        let node = currentHoveredNode;
        if (node && !view.dom.contains(node)) {
          node = null;
        }
        if (!node) {
          const coords = getAdjustedCoords(e as any, options.dragHandleWidth);
          node = nodeDOMAtCoords(coords, options, dragHandleElement) as Element | null;
        }

        let nodePos: number | null = null;
        let nodeType: string | null = null;
        if (node instanceof Element) {
          const pos = nodePosAtDOM(node, view, options.dragHandleWidth);
          const calcPos = pos == null ? null : calcNodePos(pos, view);
          nodePos = calcPos;
          if (nodePos != null) {
            const pmNode = view.state.doc.nodeAt(nodePos);
            nodeType = pmNode?.type.name ?? null;
          }
        }

        const handleRect = dragHandleElement?.getBoundingClientRect() ?? {
          top: e.clientY,
          left: e.clientX,
          right: e.clientX,
          bottom: e.clientY,
          width: 0,
          height: 0,
        };

        window.dispatchEvent(
          new CustomEvent("drag-handle-click", {
            detail: {
              nodePos,
              nodeType,
              anchorRect: {
                top: handleRect.top,
                left: handleRect.left,
                right: handleRect.right,
                bottom: handleRect.bottom,
                width: handleRect.width,
                height: handleRect.height,
              },
            },
          }),
        );
      }
      dragHandleElement.addEventListener("click", onDragHandleClick);

      function onDragHandleDragStart(e: DragEvent) {
        // Enforce state reset to prevent stale state from blocking new drag
        view.dragging = null;
        view.dom.classList.remove("dragging");

        isDragging = handleDragStart(e, view);
        if (!isDragging) {
          view.dragging = null;
          hideDragHandle();
          e.preventDefault();
        }
      }
      dragHandleElement.addEventListener("dragstart", onDragHandleDragStart);

      function stopAutoScroll() {
        if (autoScrollRafId !== null) {
          cancelAnimationFrame(autoScrollRafId);
          autoScrollRafId = null;
        }
        autoScrollDir = 0;
      }

      function startAutoScrollLoop(scrollContainer: Element, dir: -1 | 1) {
        const SPEED = 10;
        const loop = () => {
          scrollContainer.scrollTop += dir * SPEED;
          autoScrollRafId = requestAnimationFrame(loop);
        };
        autoScrollRafId = requestAnimationFrame(loop);
      }

      function onDragHandleDragEnd() {
        isDragging = false;
        view.dragging = null;
        hideDragHandle();
        stopAutoScroll();
      }
      dragHandleElement.addEventListener("dragend", onDragHandleDragEnd);

      // 使用 document dragover 事件监听鼠标位置来实现自动滚动
      // 原因：HTML5 drag 事件的 clientY 在鼠标不在有效 drop 目标上时会为 0，不可靠
      function onDocumentDragOver(e: DragEvent) {
        if (!isDragging) return;
        const SCROLL_THRESHOLD = options.scrollTreshold || 80;
        const y = e.clientY;

        const scrollContainer = findScrollContainer(view.dom);
        const containerRect = scrollContainer.getBoundingClientRect();

        if (y > containerRect.bottom - SCROLL_THRESHOLD) {
          if (autoScrollDir !== 1) {
            stopAutoScroll();
            autoScrollDir = 1;
            startAutoScrollLoop(scrollContainer, 1);
          }
        } else if (y < containerRect.top + SCROLL_THRESHOLD) {
          if (autoScrollDir !== -1) {
            stopAutoScroll();
            autoScrollDir = -1;
            startAutoScrollLoop(scrollContainer, -1);
          }
        } else {
          if (autoScrollDir !== 0) {
            stopAutoScroll();
          }
        }
      }
      document.addEventListener("dragover", onDocumentDragOver);

      function onDragHandleMouseEnter() {
        isHoveringHandle = true;
      }
      dragHandleElement.addEventListener("mouseenter", onDragHandleMouseEnter);

      function onDragHandleMouseLeave() {
        isHoveringHandle = false;
      }
      dragHandleElement.addEventListener("mouseleave", onDragHandleMouseLeave);

      function onDocumentDrop(e: DragEvent) {
        hideDragHandle();
        handleDrop(view, e);
      }
      document.addEventListener("drop", onDocumentDrop);

      hideDragHandle();
      if (!handleBySelector) {
        view?.dom?.parentElement?.appendChild(dragHandleElement);
      }

      let mouseMoveRafId: number | null = null;
      let pendingMouseEvent: MouseEvent | null = null;
      let lastMouseCoords: { x: number; y: number } | null = null;

      const processMouseMove = (event: MouseEvent) => {
        justDropped = false;

        if (isDragging) return;

        if (!view.editable) {
          hideDragHandle();
          return;
        }

        if ((event.target as HTMLElement).closest(".table-add-control")) {
          return;
        }

        // 如果鼠标在把手区域内，不更新把手位置（防止拖拽前把手跳动）
        if (dragHandleElement) {
          const handleRect = dragHandleElement.getBoundingClientRect();
          const margin = 5; // 额外边距，提高容错
          if (
            event.clientX >= handleRect.left - margin &&
            event.clientX <= handleRect.right + margin &&
            event.clientY >= handleRect.top - margin &&
            event.clientY <= handleRect.bottom + margin
          ) {
            return;
          }
        }

        const coords = getAdjustedCoords(event, options.dragHandleWidth);
        let node = nodeDOMAtCoords(coords, options, dragHandleElement);

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

        // 节点未变化时复用上一次计算结果，避免重复布局计算
        if (node === currentHoveredNode) {
          return;
        }

        updateHandlePosition(node);
      };

      const handleMouseMove = (event: MouseEvent) => {
        pendingMouseEvent = event;
        if (mouseMoveRafId !== null) return;

        mouseMoveRafId = window.requestAnimationFrame(() => {
          mouseMoveRafId = null;
          const latestEvent = pendingMouseEvent;
          pendingMouseEvent = null;
          if (!latestEvent) return;

          if (lastMouseCoords) {
            const deltaX = Math.abs(latestEvent.clientX - lastMouseCoords.x);
            const deltaY = Math.abs(latestEvent.clientY - lastMouseCoords.y);
            if (deltaX < 2 && deltaY < 2) {
              return;
            }
          }

          lastMouseCoords = {
            x: latestEvent.clientX,
            y: latestEvent.clientY,
          };

          processMouseMove(latestEvent);
        });
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
          if (mouseMoveRafId !== null) {
            window.cancelAnimationFrame(mouseMoveRafId);
            mouseMoveRafId = null;
          }
          stopAutoScroll();
          pendingMouseEvent = null;
          lastMouseCoords = null;
          if (!handleBySelector) {
            dragHandleElement?.remove();
          }
          document.removeEventListener("dragover", onDocumentDragOver);
          dragHandleElement?.removeEventListener(
            "dragstart",
            onDragHandleDragStart,
          );
          dragHandleElement?.removeEventListener("mouseenter", onDragHandleMouseEnter);
          dragHandleElement?.removeEventListener("mouseleave", onDragHandleMouseLeave);
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
          dragHandleElement?.removeEventListener("click", onDragHandleClick);
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
        dragover: (view, event) => {
          const titleNode = view.state.doc.firstChild;
          const dropPos = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          const firstDomNode = view.dom?.firstElementChild as HTMLElement | null;
          const isInTitleDomZone = (() => {
            if (!firstDomNode) return false;
            const rect = firstDomNode.getBoundingClientRect();
            const xHit =
              event.clientX >= rect.left - 12 && event.clientX <= rect.right + 12;
            const yHit = event.clientY <= rect.bottom;
            return xHit && yHit;
          })();

          if (
            (titleNode && dropPos && dropPos.pos < titleNode.nodeSize) ||
            isInTitleDomZone
          ) {
            if (event.dataTransfer) {
              event.dataTransfer.dropEffect = "none";
            }
            event.preventDefault();
            return true;
          }

          if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
          }
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
          view.dragging = null;
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
