// 自定义 GlobalDragHandle 扩展，修复默认移动行为
// 原版插件的问题：只有按住 Ctrl 才会移动节点，默认是复制
// 这个版本将默认行为改为移动

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, NodeSelection, TextSelection } from '@tiptap/pm/state'
import { Slice } from '@tiptap/pm/model'
import { dropPoint } from '@tiptap/pm/transform'
import * as pmView from '@tiptap/pm/view'

function getPmView() {
  try {
    return pmView
  } catch (error) {
    return null
  }
}

function serializeForClipboard(view: any, slice: Slice) {
  // Newer Tiptap/ProseMirror
  if (view && typeof view.serializeForClipboard === 'function') {
    return view.serializeForClipboard(slice)
  }
  // Older version fallback
  const proseMirrorView = getPmView()
  if (proseMirrorView && typeof (proseMirrorView as any)?.__serializeForClipboard === 'function') {
    return (proseMirrorView as any).__serializeForClipboard(view, slice)
  }
  throw new Error('No supported clipboard serialization method found.')
}

function absoluteRect(node: Element) {
  const data = node.getBoundingClientRect()
  const modal = node.closest('[role="dialog"]')
  if (modal && window.getComputedStyle(modal).transform !== 'none') {
    const modalRect = modal.getBoundingClientRect()
    return {
      top: data.top - modalRect.top,
      left: data.left - modalRect.left,
      width: data.width,
    }
  }
  return {
    top: data.top,
    left: data.left,
    width: data.width,
  }
}

interface DragHandleOptions {
  dragHandleWidth: number
  scrollTreshold: number
  dragHandleSelector?: string
  excludedTags: string[]
  customNodes: string[]
}

function nodeDOMAtCoords(coords: { x: number; y: number }, options: DragHandleOptions) {
  const selectors = [
    'li',
    'p:not(:first-child)',
    'pre',
    'blockquote',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    ...options.customNodes.map((node) => `[data-type=${node}]`),
  ].join(', ')
  return document
    .elementsFromPoint(coords.x, coords.y)
    .find(
      (elem) =>
        elem.parentElement?.matches?.('.ProseMirror') || elem.matches(selectors)
    )
}

function nodePosAtDOM(node: Element, view: any, options: DragHandleOptions) {
  const boundingRect = node.getBoundingClientRect()
  return view.posAtCoords({
    left: boundingRect.left + 50 + options.dragHandleWidth,
    top: boundingRect.top + 1,
  })?.inside
}

function calcNodePos(pos: number, view: any) {
  const $pos = view.state.doc.resolve(pos)
  if ($pos.depth > 1) return $pos.before($pos.depth)
  return pos
}

function DragHandlePlugin(options: DragHandleOptions & { pluginKey: string }) {


  function handleDragStart(event: DragEvent, view: any) {
    view.focus()
    if (!event.dataTransfer) return

    const node = nodeDOMAtCoords(
      {
        x: event.clientX + 50 + options.dragHandleWidth,
        y: event.clientY,
      },
      options
    )
    if (!(node instanceof Element)) return

    let draggedNodePos = nodePosAtDOM(node, view, options)
    if (draggedNodePos == null || draggedNodePos < 0) return
    draggedNodePos = calcNodePos(draggedNodePos, view)

    const { from, to } = view.state.selection
    const diff = from - to
    const fromSelectionPos = calcNodePos(from, view)

    let differentNodeSelected = false
    const nodePos = view.state.doc.resolve(fromSelectionPos)

    if (nodePos.node().type.name === 'doc') {
      differentNodeSelected = true
    } else {
      const nodeSelection = NodeSelection.create(view.state.doc, nodePos.before())
      differentNodeSelected = !(
        draggedNodePos + 1 >= nodeSelection.$from.pos &&
        draggedNodePos <= nodeSelection.$to.pos
      )
    }

    let selection = view.state.selection
    if (
      !differentNodeSelected &&
      diff !== 0 &&
      !(view.state.selection instanceof NodeSelection)
    ) {
      const endSelection = NodeSelection.create(view.state.doc, to - 1)
      selection = TextSelection.create(view.state.doc, draggedNodePos, endSelection.$to.pos)
    } else {
      selection = NodeSelection.create(view.state.doc, draggedNodePos)
      if (selection.node.type.isInline || selection.node.type.name === 'tableRow') {
        const $pos = view.state.doc.resolve(selection.from)
        selection = NodeSelection.create(view.state.doc, $pos.before())
      }
    }

    view.dispatch(view.state.tr.setSelection(selection))



    const slice = view.state.selection.content()
    const { dom, text } = serializeForClipboard(view, slice)
    event.dataTransfer.clearData()
    event.dataTransfer.setData('text/html', dom.innerHTML)
    event.dataTransfer.setData('text/plain', text)
    event.dataTransfer.effectAllowed = 'copyMove'
    event.dataTransfer.setDragImage(node, 0, 0)
    
    // 🔧 FIX: 默认设为 move: true（原版是 event.ctrlKey，需要按 Ctrl 才移动）
    view.dragging = { slice, move: true }
  }

  let dragHandleElement: HTMLElement | null = null

  function hideDragHandle() {
    if (dragHandleElement) {
      dragHandleElement.classList.add('hide')
    }
  }

  function showDragHandle() {
    if (dragHandleElement) {
      dragHandleElement.classList.remove('hide')
    }
  }

  function hideHandleOnEditorOut(event: MouseEvent) {
    if (event.target instanceof Element) {
      const relatedTarget = event.relatedTarget as Element | null
      const isInsideEditor =
        relatedTarget?.classList.contains('tiptap') ||
        relatedTarget?.classList.contains('drag-handle')
      if (isInsideEditor) return
    }
    hideDragHandle()
  }

  function handleDrop(view: any, event: DragEvent) {
    const dropPos = view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    })
    if (!dropPos) return false

    const dragging = view.dragging
    if (!dragging?.slice) return false

    const slice = dragging.slice
    let insertPos = dropPoint(view.state.doc, dropPos.pos, slice)
    if (insertPos == null) return false

    const { selection } = view.state
    const tr = view.state.tr

    if (dragging.move && !selection.empty) {
      const { from, to } = selection
      if (insertPos >= from && insertPos <= to) {
        event.preventDefault()
        return true
      }
      if (insertPos > from) {
        insertPos -= to - from
      }
      tr.delete(from, to)
    }

    tr.replaceRange(insertPos, insertPos, slice)
    view.dispatch(tr.scrollIntoView())
    event.preventDefault()
    return true
  }

  return new Plugin({
    key: new PluginKey(options.pluginKey),
    view: (view) => {
      const handleBySelector = options.dragHandleSelector
        ? document.querySelector(options.dragHandleSelector)
        : null
      dragHandleElement = (handleBySelector as HTMLElement) ?? document.createElement('div')
      dragHandleElement.draggable = true
      dragHandleElement.dataset.dragHandle = ''
      dragHandleElement.classList.add('drag-handle')

      function onDragHandleDragStart(e: DragEvent) {
        handleDragStart(e, view)
      }
      dragHandleElement.addEventListener('dragstart', onDragHandleDragStart)

      function onDragHandleDrag(e: DragEvent) {
        hideDragHandle()
        const scrollY = window.scrollY
        if (e.clientY < options.scrollTreshold) {
          window.scrollTo({ top: scrollY - 30, behavior: 'smooth' })
        } else if (window.innerHeight - e.clientY < options.scrollTreshold) {
          window.scrollTo({ top: scrollY + 30, behavior: 'smooth' })
        }
      }
      dragHandleElement.addEventListener('drag', onDragHandleDrag)

      function onDocumentDrop(e: DragEvent) {
        if (!view.dragging?.slice) return
        const rect = view.dom.getBoundingClientRect()
        const withinEditor =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        if (!withinEditor) return
        handleDrop(view, e)
      }
      function onDocumentDragEnd() {}
      document.addEventListener('drop', onDocumentDrop)
      document.addEventListener('dragend', onDocumentDragEnd)

      hideDragHandle()
      if (!handleBySelector) {
        view?.dom?.parentElement?.appendChild(dragHandleElement)
      }
      view?.dom?.parentElement?.addEventListener('mouseout', hideHandleOnEditorOut as any)

      return {
        destroy: () => {
          if (!handleBySelector) {
            dragHandleElement?.remove?.()
          }
          dragHandleElement?.removeEventListener('drag', onDragHandleDrag)
          dragHandleElement?.removeEventListener('dragstart', onDragHandleDragStart)
          document.removeEventListener('drop', onDocumentDrop)
          document.removeEventListener('dragend', onDocumentDragEnd)
          dragHandleElement = null
          view?.dom?.parentElement?.removeEventListener('mouseout', hideHandleOnEditorOut as any)
        },
      }
    },
    props: {
      handleDOMEvents: {
        mousemove: (view, event) => {
          if (!view.editable) {
            return
          }
          const node = nodeDOMAtCoords(
            {
              x: event.clientX + 50 + options.dragHandleWidth,
              y: event.clientY,
            },
            options
          )
          const notDragging = node?.closest('.not-draggable')
          const excludedTagList = options.excludedTags.concat(['ol', 'ul']).join(', ')
          if (
            !(node instanceof Element) ||
            node.matches(excludedTagList) ||
            notDragging
          ) {
            hideDragHandle()
            return
          }

          const compStyle = window.getComputedStyle(node)
          const parsedLineHeight = parseInt(compStyle.lineHeight, 10)
          const lineHeight = isNaN(parsedLineHeight)
            ? parseInt(compStyle.fontSize) * 1.2
            : parsedLineHeight
          const paddingTop = parseInt(compStyle.paddingTop, 10)
          const rect = absoluteRect(node)
          rect.top += (lineHeight - 24) / 2
          rect.top += paddingTop

          if (node.matches('ul:not([data-type=taskList]) li, ol li')) {
            rect.left -= options.dragHandleWidth
          }
          rect.width = options.dragHandleWidth

          if (!dragHandleElement) return
          dragHandleElement.style.left = `${rect.left - rect.width}px`
          dragHandleElement.style.top = `${rect.top}px`
          showDragHandle()
        },
        keydown: () => {
          hideDragHandle()
        },
        mousewheel: () => {
          hideDragHandle()
        },
        dragover: (_view, event) => {
          event.preventDefault()
          return false
        },
        dragstart: (view) => {
          view.dom.classList.add('dragging')
        },
        drop: (view, event) => {
          view.dom.classList.remove('dragging')
          hideDragHandle()
          return handleDrop(view, event)
        },
        dragend: (view) => {
          view.dom.classList.remove('dragging')
        },
      },
    },
  })
}

export const CustomGlobalDragHandle = Extension.create({
  name: 'customGlobalDragHandle',
  addOptions() {
    return {
      dragHandleWidth: 20,
      scrollTreshold: 100,
      excludedTags: [] as string[],
      customNodes: [] as string[],
    }
  },
  addProseMirrorPlugins() {
    return [
      DragHandlePlugin({
        pluginKey: 'customGlobalDragHandle',
        dragHandleWidth: this.options.dragHandleWidth,
        scrollTreshold: this.options.scrollTreshold,
        dragHandleSelector: this.options.dragHandleSelector,
        excludedTags: this.options.excludedTags,
        customNodes: this.options.customNodes,
      }),
    ]
  },
})
