import { type CSSProperties } from "react";
import "@/components/ui/sonner";
import { EditorHostBridge } from "@/pages/workspace/components/editor-host/EditorHostBridge";
import { Editor } from "@/components/editor/core/Editor";
import { Toaster } from "@/components/ui/sonner";
import { QuickNoteCollectPreview } from "./QuickNoteCollectPreview";
import { useQuickNoteDraftState } from "./quick-note-app/useQuickNoteDraftState";
import { useQuickNoteEditorActions } from "./quick-note-app/useQuickNoteEditorActions";
import { useQuickNoteSaveActions } from "./quick-note-app/useQuickNoteSaveActions";
import { useQuickNoteShortcuts } from "./quick-note-app/useQuickNoteShortcuts";
import { useQuickNoteWindowPlacement } from "./quick-note-app/useQuickNoteWindowPlacement";
import { renderQuickNoteHeader } from "./quick-note-app/renderQuickNoteHeader";

export function QuickNoteApp() {
  const draft = useQuickNoteDraftState();
  const editor = useQuickNoteEditorActions(draft);
  const save = useQuickNoteSaveActions(editor);
  const shortcuts = useQuickNoteShortcuts(save);
  const quickNoteWindowPlacementContext =
    useQuickNoteWindowPlacement(shortcuts);
  const context = quickNoteWindowPlacementContext;
  const {
    editorRef,
    collectVariant,
    zoom,
    historyEpoch,
    displaySlot,
    draftPage,
    onDraftChange,
  } = context;

  const headerBar = renderQuickNoteHeader(context);

  return (
    <div
      className="quicknote-root relative flex h-screen w-screen flex-col bg-[hsl(var(--goose-editor-bg))]"
      data-collect-variant={collectVariant ?? undefined}
    >
      {headerBar}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto page-scroll-container">
        <EditorHostBridge
          key={`${displaySlot}-${historyEpoch}`}
          page={draftPage}
          isEditorFullWidth
          contentMode="raw"
          onContentChangeOverride={onDraftChange}
        >
          {/*
            用 CSS zoom（Chromium/Electron 支持）而不是 transform:scale + 反向宽高。
            transform 不改变布局盒：缩小后 width=100/zoom% 会 > 100%，父级
            overflow-y-auto 会连带出现底部横向滚动条，放大时也会出现可视高度与
            scrollHeight 不一致。zoom 同步缩放布局与绘制，滚动条只随真实内容出现。
          */}
          <div
            className="quicknote-editor-surface flex min-h-full flex-col"
            style={{ zoom } as CSSProperties}
          >
            <Editor ref={editorRef} editable showSideMenu={false} />
          </div>
        </EditorHostBridge>
      </div>
      {collectVariant && <QuickNoteCollectPreview variant={collectVariant} />}
      <Toaster
        className="quicknote-toaster"
        position="bottom-center"
        offset={{ bottom: 30, left: 24, right: 24 }}
        mobileOffset={{ bottom: 30, left: 24, right: 24 }}
        toastOptions={{
          classNames: {
            toast: "!min-w-0 !pr-10",
            // 速记小窗单行 toast：关闭按钮保持垂直居中。
            closeButton: "!right-2.5 !top-1/2 !-translate-y-1/2",
          },
        }}
      />
    </div>
  );
}
