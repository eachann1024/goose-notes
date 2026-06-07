import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Pin, PinOff, X, MoveVertical } from "lucide-react";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useQuickNote, QUICKNOTE_MIN_HEIGHT } from "@/stores/useQuickNote";
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
  const autoResize = useQuickNote((s) => s.autoResize);
  const setAutoResize = useQuickNote((s) => s.setAutoResize);
  const setWindowHeight = useQuickNote((s) => s.setWindowHeight);

  // 内容测量容器（滚动区内的实际内容），自动模式据此算窗口高度。
  const contentRef = useRef<HTMLDivElement>(null);

  // 失焦隐藏的宽限期截止时间戳：开窗 / 重新唤起后短时间内忽略 blur，
  // 避免主窗 hideMainWindow 造成的瞬时焦点切换把刚弹出的小窗立刻收掉
  // （表现为「第一次点一下小窗就消失，要再按快捷键」）。
  const blurGraceUntilRef = useRef<number>(0);
  const armBlurGrace = () => {
    blurGraceUntilRef.current = performance.now() + 600;
  };

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
    armBlurGrace(); // 首次开窗：进入宽限期，吃掉主窗隐藏带来的瞬时失焦
    const resolvedId = useQuickNote.getState().resolveForMode(mode);
    setPageId(resolvedId);
  }, [mode]);

  // 复用窗口：父窗以「速记」再次唤起已存在的小窗时（preload 发 quicknote:enter），
  // 按新模式重解析，确保「速记」始终开新空白、「便签」直达上次。
  useEffect(() => {
    const handler = (e: Event) => {
      armBlurGrace(); // 重新唤起：同样进入宽限期
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
      // 宽限期内忽略 blur（开窗/唤起瞬间主窗隐藏会造成假失焦）。
      if (performance.now() < blurGraceUntilRef.current) return;
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

  // 自动调整高度：开启时按内容真实高度请求父窗 setSize，并记住该高度。
  // 关闭时不动窗口（用户拖多高就多高，内容超出走滚动条）。
  useEffect(() => {
    if (!autoResize) return;
    const content = contentRef.current;
    if (!content) return;

    const TITLEBAR_H = 36; // 与标题栏 h-9 一致
    // 底部缓冲：窗口始终比内容高出这一截，给块手柄（+ / ⋮⋮）悬停时 BlockNote
    // 渲染手柄造成的微抖留出空间，让微抖永远落在缓冲区内、不撑到窗口边。
    const BUFFER = 56;
    // 滞回阈值：只有内容明显变化时才调窗，配合缓冲切断微抖→跟涨的闪烁。
    const SLACK = 8;
    let raf = 0;

    // 判敛基准：记住「上一次已请求父窗的 desired」。
    // 关键——不能读 window.innerHeight：父窗 setSize 是异步跨进程的，innerHeight
    // 不随 setSize 同步刷新，用它判敛会让 desired 永远 > current → 高频 IPC 风暴 → 卡死。
    // 改为拿自己上次请求过的值比对，只在目标真正变化时才再发一次 IPC，从根上切断反馈环。
    let lastRequested = 0;
    // 拖动调宽时浏览器连续派发 resize：此窗口标志置位，期间暂停 RO 的 setHeight，
    // 避免「拖宽→折行→内容高变→RO 触发→setSize」把死循环以最高频率点燃。
    let resizing = false;
    let resizeIdle = 0;

    const apply = () => {
      if (resizing) return; // 拖动进行中不调窗，待拖动停后再统一收敛
      // 上限取当前屏幕可用高度的 80%（子窗 screen 反映其所在显示器），超过则内容滚动。
      const screenH = window.screen?.availHeight || window.innerHeight || 900;
      const maxAutoH = Math.round(screenH * 0.8);
      const contentH = content.scrollHeight;
      // 期望窗口高 = 标题栏 + 内容 + 底部缓冲（窗口比内容高出 BUFFER）。
      const desired = Math.min(
        maxAutoH,
        Math.max(QUICKNOTE_MIN_HEIGHT, Math.ceil(contentH + TITLEBAR_H + BUFFER)),
      );
      // 与「上次请求值」比对（而非 innerHeight），变化不足 SLACK 直接跳过。
      if (Math.abs(desired - lastRequested) <= SLACK) return;
      lastRequested = desired;
      quickNoteWindow.setHeight(desired);
      setWindowHeight(desired);
    };

    // rAF 合并多次回调到一帧，并规避 ResizeObserver loop 告警。
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    });
    // 拖动窗口边框时暂停自动调高：resize 事件持续则保持 resizing，停 150ms 后恢复并收敛一次。
    const onWindowResize = () => {
      resizing = true;
      clearTimeout(resizeIdle);
      resizeIdle = window.setTimeout(() => {
        resizing = false;
        // 拖动结束后以当前窗口高为新基准，避免残留旧 lastRequested 触发一次多余调窗。
        lastRequested = window.innerHeight;
        apply();
      }, 150);
    };
    window.addEventListener("resize", onWindowResize);
    ro.observe(content);
    apply(); // 立即应用一次
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(resizeIdle);
      window.removeEventListener("resize", onWindowResize);
      ro.disconnect();
    };
  }, [autoResize, setWindowHeight, pageId]);

  // 手动模式：用户拖动窗口边框改高 → 记住最终窗口高度，下次开窗沿用。
  useEffect(() => {
    if (autoResize) return;
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // outerHeight 含窗口边框，是真实窗口高度。
        const h = window.outerHeight || window.innerHeight;
        if (h >= QUICKNOTE_MIN_HEIGHT) setWindowHeight(h);
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [autoResize, setWindowHeight]);

  const isEditorFullWidth = useNotebooks((s) => {
    const nbId = s.activeNotebookId;
    const nb = nbId ? s.notebooks[nbId] : null;
    return nb?.editorFullWidth ?? false;
  });

  const headerBar = useMemo(
    () => (
      <div
        className="quicknote-titlebar flex h-9 shrink-0 items-center justify-between gap-1 px-2"
        style={{ WebkitAppRegion: "drag" } as CSSProperties}
      >
        <button
          type="button"
          aria-label={autoResize ? "关闭自动调整高度" : "开启自动调整高度"}
          title={autoResize ? "自动调整高度：开" : "自动调整高度：关"}
          className={`quicknote-titlebar-btn flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-muted ${
            autoResize
              ? "text-primary hover:text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
          onClick={() => setAutoResize(!autoResize)}
        >
          <MoveVertical className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-1">
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
      </div>
    ),
    [pinned, setPinned, autoResize, setAutoResize],
  );

  return (
    <div className="quicknote-root flex h-screen w-screen flex-col overflow-hidden bg-[hsl(var(--goose-editor-bg))]">
      {headerBar}
      <div className="min-h-0 flex-1 overflow-y-auto page-scroll-container">
        {page ? (
          <EditorHostBridge page={page} isEditorFullWidth={isEditorFullWidth}>
            <div
              ref={contentRef}
              className={`quicknote-editor-surface flex flex-col pt-2 ${
                autoResize ? "" : "min-h-full"
              }`}
            >
              <Editor
                ref={editorRef}
                editable={!page.isLocked && !page.trashedAt}
                hiddenSlashItemTitles={QUICKNOTE_HIDDEN_SLASH_ITEMS}
                showSideMenu={false}
              />
            </div>
          </EditorHostBridge>
        ) : null}
      </div>
      <Toaster />
    </div>
  );
}
