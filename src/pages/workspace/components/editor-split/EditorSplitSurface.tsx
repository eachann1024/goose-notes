import {
  Fragment,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  Group,
  Panel,
  Separator,
  useGroupRef,
  type Layout,
} from "react-resizable-panels";
import { useStoreWithEqualityFn } from "zustand/traditional";
import {
  findLeaf,
  normalizeSizes,
} from "@/lib/editor-split/tree";
import type { SplitGroup, SplitLeaf, SplitState } from "@/lib/editor-split/types";
import { focusSplitPane } from "@/lib/editor-split/commands";
import { useEditorSplit } from "@/stores/useEditorSplit";

export type EditorSplitPaneRenderContext = {
  focused: boolean;
  zoomed: boolean;
};

export type EditorSplitSurfaceProps = {
  tabId: string;
  renderPane: (leaf: SplitLeaf, ctx: EditorSplitPaneRenderContext) => ReactNode;
  onContextMenu?: (event: MouseEvent, leaf: SplitLeaf) => void;
};

function sizesToLayout(group: SplitGroup): Layout {
  const sizes = normalizeSizes(group.sizes, group.children.length);
  const layout: Layout = {};
  for (let i = 0; i < group.children.length; i += 1) {
    layout[group.children[i].id] = sizes[i] ?? 0;
  }
  return layout;
}

function layoutToSizes(group: SplitGroup, layout: Layout): number[] {
  return normalizeSizes(
    group.children.map((child) => layout[child.id] ?? 0),
    group.children.length,
  );
}

function equalLayout(group: SplitGroup): Layout {
  const each = 100 / group.children.length;
  const layout: Layout = {};
  for (const child of group.children) {
    layout[child.id] = each;
  }
  return layout;
}

function syncSashValueText(el: HTMLDivElement | null) {
  if (!el) return;
  const now = el.getAttribute("aria-valuenow");
  if (now == null) return;
  const numeric = Number(now);
  el.setAttribute(
    "aria-valuetext",
    Number.isFinite(numeric) ? `${Math.round(numeric)}%` : now,
  );
}

function SplitSash({
  id,
  onEqualize,
}: {
  id: string;
  onEqualize: () => void;
}) {
  const elementRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    syncSashValueText(el);
    const observer = new MutationObserver(() => syncSashValueText(el));
    observer.observe(el, {
      attributes: true,
      attributeFilter: ["aria-valuenow"],
    });
    return () => observer.disconnect();
  }, []);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  return (
    <Separator
      id={id}
      className="editor-split-sash"
      disableDoubleClick
      elementRef={elementRef}
      onPointerDown={onPointerDown}
      onDoubleClick={(event) => {
        event.preventDefault();
        onEqualize();
      }}
    />
  );
}

function SplitPane({
  tabId,
  leaf,
  focused,
  zoomed,
  renderPane,
  onContextMenu,
}: {
  tabId: string;
  leaf: SplitLeaf;
  focused: boolean;
  zoomed: boolean;
  renderPane: EditorSplitSurfaceProps["renderPane"];
  onContextMenu?: EditorSplitSurfaceProps["onContextMenu"];
}) {
  return (
    <div
      role="region"
      aria-label={leaf.title ?? leaf.pageId}
      className="editor-split-pane"
      data-focused={focused ? "true" : "false"}
      data-zoomed={zoomed ? "true" : "false"}
      data-pane-id={leaf.id}
      onPointerDownCapture={() => {
        // 只同步当前分屏与全局页面状态。不可在本次 pointer 的默认选区之后
        // 再 rAF 聚焦编辑器，否则表格 cell、正文、嵌入输入框中的落点会被
        // `focus-editor-body` 重置到页面开头。
        if (!focused) focusSplitPane(tabId, leaf.id, { focusEditor: false });
      }}
      onContextMenu={
        onContextMenu
          ? (event) => {
              onContextMenu(event, leaf);
            }
          : undefined
      }
    >
      <div className="editor-split-pane-body">{renderPane(leaf, { focused, zoomed })}</div>
    </div>
  );
}

function SplitGroupView({
  tabId,
  group,
  splitState,
  renderPane,
  onContextMenu,
}: {
  tabId: string;
  group: SplitGroup;
  splitState: SplitState;
  renderPane: EditorSplitSurfaceProps["renderPane"];
  onContextMenu?: EditorSplitSurfaceProps["onContextMenu"];
}) {
  const groupRef = useGroupRef();
  const [dragging, setDragging] = useState(false);

  const persistLayout = useCallback(
    (layout: Layout) => {
      useEditorSplit
        .getState()
        .setGroupSizes(tabId, group.id, layoutToSizes(group, layout));
    },
    [group, tabId],
  );

  const equalize = useCallback(() => {
    const layout = equalLayout(group);
    groupRef.current?.setLayout(layout);
    persistLayout(layout);
  }, [group, groupRef, persistLayout]);

  return (
    <Group
      id={group.id}
      groupRef={groupRef}
      orientation={group.orientation}
      defaultLayout={sizesToLayout(group)}
      className="editor-split-group"
      data-dragging={dragging ? "true" : undefined}
      resizeTargetMinimumSize={{ coarse: 24, fine: 8 }}
      onLayoutChange={() => setDragging(true)}
      onLayoutChanged={(layout, meta) => {
        setDragging(false);
        if (meta.isUserInteraction) persistLayout(layout);
      }}
    >
      {group.children.map((child, index) => (
        <Fragment key={child.id}>
          {index > 0 ? (
            <SplitSash id={`${group.id}-sash-${index}`} onEqualize={equalize} />
          ) : null}
          <Panel id={child.id} minSize="10%" defaultSize={`${group.sizes[index]}%`}>
            {child.kind === "leaf" ? (
              <SplitPane
                tabId={tabId}
                leaf={child}
                focused={child.id === splitState.focusedLeafId}
                zoomed={false}
                renderPane={renderPane}
                onContextMenu={onContextMenu}
              />
            ) : (
              <SplitGroupView
                key={`${child.id}:${child.children.map((nested) => nested.id).join(",")}`}
                tabId={tabId}
                group={child}
                splitState={splitState}
                renderPane={renderPane}
                onContextMenu={onContextMenu}
              />
            )}
          </Panel>
        </Fragment>
      ))}
    </Group>
  );
}

export function EditorSplitSurface({
  tabId,
  renderPane,
  onContextMenu,
}: EditorSplitSurfaceProps) {
  const splitState = useStoreWithEqualityFn(
    useEditorSplit,
    (state) => state.byTabId[tabId] ?? null,
  );

  if (!splitState) return null;

  const zoomedLeaf = splitState.zoomedLeafId
    ? findLeaf(splitState.root, splitState.zoomedLeafId)
    : null;

  if (zoomedLeaf) {
    return (
      <div className="editor-split-surface editor-split-surface--zoomed" data-editor-split="true">
        <SplitPane
          tabId={tabId}
          leaf={zoomedLeaf}
          focused
          zoomed
          renderPane={renderPane}
          onContextMenu={onContextMenu}
        />
      </div>
    );
  }

  if (splitState.root.kind === "leaf") {
    return (
      <div className="editor-split-surface">
        <SplitPane
          tabId={tabId}
          leaf={splitState.root}
          focused
          zoomed={false}
          renderPane={renderPane}
          onContextMenu={onContextMenu}
        />
      </div>
    );
  }

  return (
    <div className="editor-split-surface" data-editor-split="true">
      <SplitGroupView
        key={`${splitState.root.id}:${splitState.root.children.map((child) => child.id).join(",")}`}
        tabId={tabId}
        group={splitState.root}
        splitState={splitState}
        renderPane={renderPane}
        onContextMenu={onContextMenu}
      />
    </div>
  );
}
