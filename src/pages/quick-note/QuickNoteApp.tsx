import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Pin, PinOff, X } from "lucide-react";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useQuickNote } from "@/stores/useQuickNote";
import { EditorHostBridge } from "@/pages/workspace/components/editor-host/EditorHostBridge";
import { Editor, type EditorRef } from "@/components/editor/core/Editor";
import { Toaster } from "@/components/ui/sonner";
import { quickNoteWindow } from "@/lib/utools/quickNoteWindow";

// 速记小窗砍掉的斜杠菜单重型项（按 title 精确匹配），保留标题/列表/待办/引用/标注/代码/分隔线。
const QUICKNOTE_HIDDEN_SLASH_ITEMS = [
  "生成",
  "表格",
  "数学公式",
  "Mermaid 图表",
  "图片",
  "文件",
];

/**
 * 速记小窗根组件（独立窗口进程）。
 *
 * 复用主应用的编辑器内核：通过 <EditorHostBridge page={page}> 注入当前笔记 +
 * 平台能力，再渲染 <Editor>。不渲染侧栏/标签栏/大纲等外围模块——小窗只有编辑区。
 *
 * 启动模式由 URL hash 决定（# 后跟 new / last），见 quicknote.tsx。
 */
export function QuickNoteApp({ mode }: { mode: "new" | "last" }) {
  const editorRef = useRef<EditorRef>(null);
  const [pageId, setPageId] = useState<string | null>(null);

  const pinned = useQuickNote((s) => s.pinned);
  const setPinned = useQuickNote((s) => s.setPinned);

  // 订阅 pages 变化，确保编辑器在 page 内容更新时拿到最新引用。
  const page = usePages((s) => (pageId ? s.pages[pageId] : undefined));

  // 跨窗同步：小窗每次落库（updatedAt 变化）后通知主窗从 db 重读该页，防脏写。
  const lastNotifiedRef = useRef<number>(0);
  useEffect(() => {
    if (!page) return;
    if (page.updatedAt === lastNotifiedRef.current) return;
    lastNotifiedRef.current = page.updatedAt;
    quickNoteWindow.notifyNoteUpdated(page.id);
  }, [page?.id, page?.updatedAt]);

  // 反向同步：主窗改了笔记 → 小窗从 db 重读。reload 写入的是 db 值（不重新落库），
  // 同步把 lastNotifiedRef 设为新 updatedAt，避免上面的 effect 把它再回推主窗（防回环）。
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ pageId?: string }>).detail;
      const id = detail?.pageId;
      if (!id) return;
      const updated = usePages.getState().reloadPageFromStorage(id);
      if (updated) {
        const fresh = usePages.getState().pages[id];
        if (fresh) lastNotifiedRef.current = fresh.updatedAt;
      }
    };
    window.addEventListener("goose-note:note-updated-external", handler);
    return () =>
      window.removeEventListener("goose-note:note-updated-external", handler);
  }, []);

  // 首帧：按模式解析要编辑的笔记（hydration 已在 bootstrap 完成）。
  useEffect(() => {
    const resolvedId = useQuickNote.getState().resolveForMode(mode);
    setPageId(resolvedId);
  }, [mode]);

  // 复用窗口：父窗以「速记」再次唤起已存在的小窗时（preload 发 quicknote:enter），
  // 按新模式重解析，确保「速记」始终开新空白、「便签」直达上次。
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ mode?: "new" | "last" }>).detail;
      const nextMode = detail?.mode === "last" ? "last" : "new";
      const resolvedId = useQuickNote.getState().resolveForMode(nextMode);
      setPageId(resolvedId);
      requestAnimationFrame(() => editorRef.current?.editor?.focus?.());
    };
    window.addEventListener("goose-note:quicknote-enter", handler);
    return () =>
      window.removeEventListener("goose-note:quicknote-enter", handler);
  }, []);

  // 置顶状态变化时同步给窗口（preload 通过 utools 设置 alwaysOnTop / 失焦行为）。
  useEffect(() => {
    quickNoteWindow.setPinned(pinned);
  }, [pinned]);

  // Raycast 手感：呼出即聚焦光标到编辑器。仅在切换笔记（pageId 变）时聚焦，
  // 不依赖 page 内容引用——否则每次落库/反向同步 reload 都会抢焦点。
  useEffect(() => {
    if (!pageId) return;
    requestAnimationFrame(() => editorRef.current?.editor?.focus?.());
  }, [pageId]);

  // 失焦自动隐藏（Raycast 核心手感）：钉住时不隐藏。
  // 子窗拿不到 win 实例事件，用 web 原生 blur，再请求父窗 hide。
  useEffect(() => {
    const onBlur = () => {
      if (useQuickNote.getState().pinned) return;
      quickNoteWindow.hide();
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  // Esc 收起窗口。
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        quickNoteWindow.hide();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const isEditorFullWidth = useNotebooks((s) => {
    const nbId = s.activeNotebookId;
    const nb = nbId ? s.notebooks[nbId] : null;
    return nb?.editorFullWidth ?? false;
  });

  const headerBar = useMemo(
    () => (
      <div
        className="quicknote-titlebar flex h-9 shrink-0 items-center justify-end gap-1 px-2"
        style={{ WebkitAppRegion: "drag" } as CSSProperties}
      >
        <button
          type="button"
          aria-label={pinned ? "取消置顶" : "置顶"}
          className="quicknote-titlebar-btn flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
          onClick={() => setPinned(!pinned)}
        >
          {pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          aria-label="关闭"
          className="quicknote-titlebar-btn flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
          onClick={() => quickNoteWindow.close()}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    ),
    [pinned, setPinned],
  );

  return (
    <div className="quicknote-root flex h-screen w-screen flex-col overflow-hidden bg-[hsl(var(--goose-editor-bg))]">
      {headerBar}
      <div className="min-h-0 flex-1 overflow-y-auto page-scroll-container">
        {page ? (
          <EditorHostBridge page={page} isEditorFullWidth={isEditorFullWidth}>
            <div className="flex min-h-full flex-col px-6 pt-2">
              <Editor
                ref={editorRef}
                editable={!page.isLocked && !page.trashedAt}
                hiddenSlashItemTitles={QUICKNOTE_HIDDEN_SLASH_ITEMS}
              />
            </div>
          </EditorHostBridge>
        ) : null}
      </div>
      <Toaster />
    </div>
  );
}
