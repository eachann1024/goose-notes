import { useCallback, useLayoutEffect, useRef } from "react";
import { X } from "@/components/ui/icons";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Editor, type EditorRef } from "@/components/editor/core/Editor";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { closeSplitPaneFromUi } from "@/lib/editor-split/commands";
import type { SplitLeaf } from "@/lib/editor-split/types";
import { cn } from "@/lib/utils";
import { EditorHostBridge } from "@/pages/workspace/components/editor-host/EditorHostBridge";
import { useScrollRestoration } from "@/pages/workspace/hooks/useScrollRestoration";
import { usePages } from "@/stores/usePages";
import { useEditorPaneRegistry } from "./editorPaneRegistry";
import { useSettings } from "@/stores/useSettings";
import { SearchEditorBridge } from "../sidebar/SearchEditorBridge";
import { normalizePageLayout } from "@/lib/local-frontmatter";

function SplitPaneCloseButton({
  tabId,
  leafId,
  alwaysVisible,
}: {
  tabId: string;
  leafId: string;
  alwaysVisible: boolean;
}) {
  return (
    <button
      type="button"
      aria-label="关闭此格"
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]",
        alwaysVisible
          ? "opacity-100"
          : "opacity-0 group-hover/split-chrome:opacity-100",
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        closeSplitPaneFromUi(tabId, leafId);
      }}
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

export function SplitEditorPane({
  tabId,
  leaf,
  focused,
  showChrome,
}: {
  tabId: string;
  leaf: SplitLeaf;
  focused: boolean;
  showChrome: boolean;
}) {
  const registry = useEditorPaneRegistry();
  const defaultLayout = useSettings(state => state.defaultPageLayout);
  const editorRef = useRef<EditorRef | null>(null);
  const scrollElRef = useRef<HTMLDivElement | null>(null);
  const setEditorRef = useCallback(
    (instance: EditorRef | null) => {
      editorRef.current = instance;
      registry.register(leaf.id, leaf.pageId, editorRef, scrollElRef.current);
    },
    [leaf.id, leaf.pageId, registry],
  );
  useScrollRestoration(leaf.pageId, scrollElRef);
  const page = usePages((state) => state.pages[leaf.pageId]);
  const title = page ? getPageTitle(page) : (leaf.title ?? "页面已不存在");

  useLayoutEffect(() => {
    registry.register(leaf.id, leaf.pageId, editorRef, scrollElRef.current);
    if (focused) registry.setFocused(leaf.id);
  }, [focused, leaf.id, leaf.pageId, registry]);

  useLayoutEffect(() => {
    return () => registry.unregister(leaf.id);
  }, [leaf.id, registry]);

  if (!page) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {showChrome ? (
          <div
            data-split-chrome
            className="group/split-chrome flex h-8 shrink-0 items-center gap-1 border-b border-border px-3"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
              {title}
            </span>
            <SplitPaneCloseButton
              tabId={tabId}
              leafId={leaf.id}
              alwaysVisible
            />
          </div>
        ) : null}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-sm text-muted-foreground">
          <p>找不到这篇笔记</p>
          <button
            type="button"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
            onClick={() => closeSplitPaneFromUi(tabId, leaf.id)}
          >
            关闭此格
          </button>
        </div>
      </div>
    );
  }

  const isLocalFilePage = Boolean(page.localFilePath);
  const editable = !page.isLocked && !page.trashedAt;

  return (
    <div
      className="relative flex h-full min-h-0 min-w-0 flex-col"
      data-font-family={page.fontFamily ?? "default"}
      data-page-layout={normalizePageLayout(page.pageLayout ?? defaultLayout)}
      data-local-file-page={isLocalFilePage ? "true" : undefined}
    >
      {showChrome ? (
        <div
          data-split-chrome
          className="group/split-chrome flex h-8 shrink-0 items-center gap-1 border-b border-border px-3"
        >
          <span
            className="min-w-0 flex-1 truncate text-sm font-medium text-foreground"
            title={title}
          >
            {title}
          </span>
          <SplitPaneCloseButton
            tabId={tabId}
            leafId={leaf.id}
            alwaysVisible={false}
          />
        </div>
      ) : null}
      <EditorHostBridge page={page} isEditorFullWidth>
        <div className="page-layout-body flex min-h-0 min-w-0 flex-1">
        <div
          ref={(el) => {
            scrollElRef.current = el;
            if (el) registry.register(leaf.id, leaf.pageId, editorRef, el);
          }}
          tabIndex={-1}
          className="page-scroll-container h-full min-h-0 min-w-0 flex-1 overflow-y-auto [background:var(--goose-editor-surface)]"
        >
          <div className="page-layout-document flex min-h-full flex-col">
            <ErrorBoundary
              resetKey={leaf.pageId}
              fallback={(_, reset) => (
                <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
                  <p>当前格子渲染失败，已阻止整窗白屏。</p>
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
                  >
                    重试
                  </button>
                </div>
              )}
            >
              <Editor
                ref={setEditorRef}
                editable={editable}
                isActiveEditor={focused}
              />
            </ErrorBoundary>
          </div>
        </div>
        </div>
      </EditorHostBridge>
      <SearchEditorBridge pageId={leaf.pageId} focused={focused} editorRef={editorRef} scrollRef={scrollElRef} />
    </div>
  );
}
