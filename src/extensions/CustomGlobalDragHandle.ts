import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, NodeSelection } from "@tiptap/pm/state";
import { Slice } from "@tiptap/pm/model";
import { dropPoint } from "@tiptap/pm/transform";
import * as pmView from "@tiptap/pm/view";

// --- Helper Functions ---

function getPmView() {
  try {
    return pmView;
  } catch (error) {
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

function absoluteRect(node: Element) {
  const data = node.getBoundingClientRect();
  const modal = node.closest('[role="dialog"]');
  if (modal && window.getComputedStyle(modal).transform !== "none") {
    const modalRect = modal.getBoundingClientRect();
    return {
      top: data.top - modalRect.top,
      left: data.left - modalRect.left,
      width: data.width,
    };
  }
  return {
    top: data.top,
    left: data.left,
    width: data.width,
  };
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
    "h1",
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
    return (
      elem.parentElement?.matches?.(".ProseMirror") || elem.matches(selectors)
    );
  });
}

function nodePosAtDOM(node: Element, view: any, options: DragHandleOptions) {
  const boundingRect = node.getBoundingClientRect();
  return view.posAtCoords({
    left: boundingRect.left + 50 + options.dragHandleWidth,
    top: boundingRect.top + 1,
  })?.inside;
}

function calcNodePos(pos: number, view: any) {
  const $pos = view.state.doc.resolve(pos);

  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (node.type.name === "table") {
      return $pos.before(d);
    }
  }

  if ($pos.depth > 1) return $pos.before($pos.depth);
  return pos;
}

// --- Main Plugin ---

function DragHandlePlugin(options: DragHandleOptions & { pluginKey: string }) {
  let dragHandleElement: HTMLElement | null = null;
  let currentHoveredNode: Element | null = null;

  function updateHandleBySelectionFallback(view: any) {
    const { selection } = view.state;
    if (!selection || selection.empty === undefined) return false;

    const pos = selection.$from.pos;
    const resolved = view.state.doc.resolve(pos);
    const nodePos = resolved.depth > 0 ? resolved.before(1) : pos;
    const domNode = view.nodeDOM(nodePos);
    if (!(domNode instanceof Element)) return false;

    const excludedTagList = options.excludedTags
      .concat(["ol", "ul"])
      .join(", ");
    if (domNode.matches(excludedTagList) || domNode.closest(".not-draggable")) {
      return false;
    }

    updateHandlePosition(domNode);
    return true;
  }

  function hideDragHandle() {
    if (dragHandleElement) {
      dragHandleElement.classList.add("hide");
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
    const compStyle = window.getComputedStyle(node);
    const paddingTop = parseInt(compStyle.paddingTop, 10);
    const rect = absoluteRect(node);

    const isTableWrapper = node.matches(".tableWrapper");
    const isTable = node.matches("table");
    const isCodeBlock = node.matches("pre");

    let targetNode = node;
    if (isTableWrapper) {
      const table = node.querySelector("table");
      if (table) targetNode = table;
    }

    // 表格和代码块不添加 paddingTop，直接使用元素顶部边界
    // 避免鼠标在内容区和边框/间隙切换时手柄抖动
    if (isTableWrapper || isTable) {
      const tableRect = absoluteRect(targetNode);
      rect.top = tableRect.top;
    } else if (!isCodeBlock) {
      rect.top += paddingTop;
    }

    if (node.matches("ul:not([data-type=taskList]) li, ol li")) {
      rect.left -= options.dragHandleWidth;
    }
    rect.width = options.dragHandleWidth;

    dragHandleElement.style.left = `${rect.left - rect.width}px`;
    dragHandleElement.style.top = `${rect.top}px`;

    currentHoveredNode = node;
    showDragHandle();
  }

  function updateHandleBySelection(view: any) {
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

    const pos = selection.$from.pos;
    const resolved = view.state.doc.resolve(pos);
    const nodePos = resolved.depth > 0 ? resolved.before(1) : pos;
    const domNode = view.nodeDOM(nodePos);

    if (domNode instanceof Element) {
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
    }
    hideDragHandle();
  }

  function hideHandleOnEditorOut(event: MouseEvent) {
    if (dragHandleElement) {
      const handleRect = dragHandleElement.getBoundingClientRect();
      if (
        event.clientX <= handleRect.right + 20 &&
        event.clientX >= handleRect.left - 10
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
    hideDragHandle();
  }

  function handleDragStart(event: DragEvent, view: any) {
    view.focus();
    if (!event.dataTransfer) return;

    let node = currentHoveredNode;
    if (!node) {
      node = nodeDOMAtCoords(
        {
          x: event.clientX + 50 + options.dragHandleWidth,
          y: event.clientY,
        },
        options,
      ) as Element | null;
    }
    if (!(node instanceof Element)) return;

    let pos = nodePosAtDOM(node, view, options);
    if (pos == null) return;

    let targetPos = calcNodePos(pos, view);

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

    let insertPos = dropPoint(view.state.doc, dropPos.pos, dragging.slice);
    if (insertPos == null) return false;

    if (dragging.move) {
      // Use stored coordinates specifically to ensure we delete the correct range
      const from = dragging.from ?? view.state.selection.from;
      const to = dragging.to ?? view.state.selection.to;

      // Critical: prevents dropping inside the dragged node
      if (insertPos >= from && insertPos <= to) {
        return false;
      }

      const tr = view.state.tr;
      tr.delete(from, to);
      const mappedPos = tr.mapping.map(insertPos);
      tr.insert(mappedPos, dragging.slice.content);
      view.dispatch(tr.scrollIntoView());
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

      function onDragHandleDragStart(e: DragEvent) {
        handleDragStart(e, view);
      }
      dragHandleElement.addEventListener("dragstart", onDragHandleDragStart);

      function onDragHandleDrag() {
        hideDragHandle();
      }
      dragHandleElement.addEventListener("drag", onDragHandleDrag);

      function onDocumentDrop(e: DragEvent) {
        handleDrop(view, e);
      }
      // Attach to document to catch wide drops
      document.addEventListener("drop", onDocumentDrop);

      hideDragHandle();
      if (!handleBySelector) {
        view?.dom?.parentElement?.appendChild(dragHandleElement);
      }
      view?.dom?.parentElement?.addEventListener(
        "mouseout",
        hideHandleOnEditorOut as any,
      );

      return {
        update: () => {
          requestAnimationFrame(() => updateHandleBySelection(view));
        },
        destroy: () => {
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
          dragHandleElement = null;
        },
      };
    },
    props: {
      handleDOMEvents: {
        mousemove: (view, event) => {
          if (!view.editable) {
            hideDragHandle();
            return;
          }
          if ((event.target as HTMLElement).closest(".table-add-control")) {
            hideDragHandle();
            return;
          }

          const node = nodeDOMAtCoords(
            {
              x: event.clientX + 50 + options.dragHandleWidth,
              y: event.clientY,
            },
            options,
          );

          if (!node || !(node instanceof Element)) {
            if (!updateHandleBySelectionFallback(view)) {
              hideDragHandle();
            }
            return;
          }

          const excludedTagList = options.excludedTags
            .concat(["ol", "ul"])
            .join(", ");
          if (node.matches(excludedTagList) || node.closest(".not-draggable")) {
            if (!updateHandleBySelectionFallback(view)) {
              hideDragHandle();
            }
            return;
          }

          updateHandlePosition(node);
        },
        keydown: () => {
          hideDragHandle();
        },
        mousewheel: () => {
          hideDragHandle();
        },
        dragstart: (view) => {
          view.dom.classList.add("dragging");
        },
        dragover: (_view, event) => {
          event.preventDefault(); // Allow drop
          return false;
        },
        drop: (view, event) => {
          view.dom.classList.remove("dragging");
          hideDragHandle();
          // We rely on document listener for broad coverage, but keeping this for specificity
          // If return true, proseMirror doesn't fire other handlers.
          // Let's rely on handleDrop returning boolean.
          return handleDrop(view, event);
        },
        dragend: (view) => {
          view.dom.classList.remove("dragging");
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
