import { useCallback, useMemo, useState, type ReactNode } from "react";
import { getNodeById } from "@blocknote/core";
import { TableHandlesExtension } from "@blocknote/core/extensions";
import {
  GenericPopover,
  TableCellButton,
  useBlockNoteEditor,
  useExtensionState,
} from "@blocknote/react";
import { offset, size, type Placement } from "@floating-ui/react";
import { EDITOR_UI_SCALE_CHANGE_EVENT } from "@/lib/appearance";
import { GooseTableExtendButton, GooseTableHandle } from "./GooseTableHandle";
import { tableHandleRect, releaseTableChrome } from "./tableHandleGeometry";

type Chrome =
  | "row"
  | "column"
  | "cell"
  | "addOrRemoveRows"
  | "addOrRemoveColumns";

function TableChrome({
  element,
  getRect,
  placement,
  gap,
  stretch,
  children,
}: {
  element: Element;
  getRect?: () => DOMRect;
  placement: Placement;
  gap: number;
  stretch?: "width" | "height";
  children: ReactNode;
}) {
  const reference = useMemo(
    () => ({ element, ...(getRect ? { getBoundingClientRect: getRect } : {}) }),
    [element, getRect],
  );
  // GenericPopover already installs autoUpdate (scroll, resize, element resize and layout shift).
  const onMount = useCallback(
    (_reference: unknown, _floating: HTMLElement, update: () => void) => {
      window.addEventListener(EDITOR_UI_SCALE_CHANGE_EVENT, update);
      return () =>
        window.removeEventListener(EDITOR_UI_SCALE_CHANGE_EVENT, update);
    },
    [],
  );
  return (
    <GenericPopover
      reference={reference}
      useFloatingOptions={{
        open: true,
        placement,
        whileElementsMounted: onMount,
        middleware: [
          offset(gap),
          ...(stretch
            ? [
                size({
                  apply({ rects, elements }) {
                    // Do not substitute availableWidth/Height: those describe viewport clipping, not the table.
                    elements.floating.style[stretch] =
                      `${rects.reference[stretch]}px`;
                  },
                }),
              ]
            : []),
        ],
      }}
      focusManagerProps={{ disabled: true }}
      useTransitionStylesProps={{ duration: 0 }}
      elementProps={{ style: { zIndex: 10 } }}
    >
      {children}
    </GenericPopover>
  );
}

/** Project adapter around BlockNote's plugin, not a second table state/coordinate system. */
export function GooseTableHandlesController() {
  const editor = useBlockNoteEditor<any, any, any>();
  const state = useExtensionState(TableHandlesExtension);
  const [only, setOnly] = useState<Chrome>();
  const hide = useMemo(
    () =>
      Object.fromEntries(
        (
          [
            "row",
            "column",
            "cell",
            "addOrRemoveRows",
            "addOrRemoveColumns",
          ] as Chrome[]
        ).map((key) => [
          key,
          (hidden: boolean) =>
            setOnly((current) =>
              hidden ? key : releaseTableChrome(current, key),
            ),
        ]),
      ) as Record<Chrome, (hidden: boolean) => void>,
    [],
  );
  if (!state?.show || !editor.isEditable) return null;
  const node = getNodeById(state.block.id, editor.prosemirrorState.doc);
  if (!node) return null;
  const dom = editor.prosemirrorView.domAtPos(node.posBeforeNode + 3).node;
  const table = (dom instanceof Element ? dom : dom.parentElement)?.closest(
    "table",
  );
  if (!table) return null;
  const rowIndex = state.rowIndex;
  const colIndex = state.colIndex;
  const cell =
    rowIndex === undefined || colIndex === undefined
      ? undefined
      : table.rows[rowIndex]?.cells[colIndex];
  const visible = (key: Chrome) => !only || only === key;
  const handleRect = (axis: "row" | "column") => () =>
    DOMRect.fromRect(
      tableHandleRect(
        table.getBoundingClientRect(),
        cell!.getBoundingClientRect(),
        axis,
        state.draggingState,
      ),
    );
  return (
    <>
      {cell && visible("row") && (
        <TableChrome
          element={table}
          getRect={handleRect("row")}
          placement="left"
          gap={4}
        >
          <GooseTableHandle orientation="row" hideOtherElements={hide.row} />
        </TableChrome>
      )}
      {cell && visible("column") && (
        <TableChrome
          element={table}
          getRect={handleRect("column")}
          placement="top"
          gap={4}
        >
          <GooseTableHandle
            orientation="column"
            hideOtherElements={hide.column}
          />
        </TableChrome>
      )}
      {cell && visible("cell") && (
        <TableChrome element={cell} placement="top-end" gap={-15}>
          <TableCellButton hideOtherElements={hide.cell} />
        </TableChrome>
      )}
      {visible("addOrRemoveRows") && (
        <TableChrome element={table} placement="bottom" gap={4} stretch="width">
          <GooseTableExtendButton
            orientation="addOrRemoveRows"
            hideOtherElements={hide.addOrRemoveRows}
          />
        </TableChrome>
      )}
      {visible("addOrRemoveColumns") && (
        <TableChrome element={table} placement="right" gap={4} stretch="height">
          <GooseTableExtendButton
            orientation="addOrRemoveColumns"
            hideOtherElements={hide.addOrRemoveColumns}
          />
        </TableChrome>
      )}
    </>
  );
}
